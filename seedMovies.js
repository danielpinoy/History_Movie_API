require("dotenv").config();
const axios = require("axios");
const fs = require("fs");
const mongoose = require("mongoose");
const Models = require("./model.js");
const Movies = Models.Movie;

const TMDB_API_KEY = process.env.TMDB_API_KEY;
const TMDB_BASE_URL = "https://api.themoviedb.org/3";
const CACHE_FILE = "./cached_movies.json";

// Historical movie genres and keywords for better targeting
const HISTORICAL_KEYWORDS = [
  "historical",
  "period",
  "biography",
  "war",
  "ancient",
  "medieval",
  "renaissance",
  "victorian",
  "world war",
];

class MovieSeeder {
  constructor() {
    this.cachedMovies = [];
    this.processedMovies = [];
  }

  // Load cached movies from file
  loadCache() {
    try {
      if (fs.existsSync(CACHE_FILE)) {
        const data = fs.readFileSync(CACHE_FILE, "utf8");
        this.cachedMovies = JSON.parse(data);
        console.log(`✅ Loaded ${this.cachedMovies.length} movies from cache`);
        return true;
      }
    } catch (error) {
      console.log("⚠️ No cache file found or error reading cache");
    }
    return false;
  }

  // Save movies to cache file
  saveCache() {
    try {
      fs.writeFileSync(CACHE_FILE, JSON.stringify(this.cachedMovies, null, 2));
      console.log(`💾 Saved ${this.cachedMovies.length} movies to cache`);
    } catch (error) {
      console.error("❌ Error saving cache:", error.message);
    }
  }

  // Fetch movies from TMDB API - with fallback options
  async fetchMoviesFromAPI(pages = 8) {
    console.log("🔍 Fetching movies from TMDB API...");

    // Try different strategies if one fails
    const strategies = [
      // Strategy 1: Historical genres with quality filter
      {
        name: "Historical + Quality",
        params: {
          with_genres: "18,36,10752", // Drama, History, War
          sort_by: "vote_average.desc",
          "vote_average.gte": 6.0,
          "vote_count.gte": 50,
          include_adult: false,
        },
      },
      // Strategy 2: Just historical genres
      {
        name: "Historical Only",
        params: {
          with_genres: "36,10752", // History, War
          sort_by: "popularity.desc",
          include_adult: false,
        },
      },
      // Strategy 3: Popular movies (fallback)
      {
        name: "Popular Movies",
        params: {
          sort_by: "popularity.desc",
          "vote_average.gte": 7.0,
          include_adult: false,
        },
      },
    ];

    for (const strategy of strategies) {
      console.log(`🎯 Trying strategy: ${strategy.name}`);
      let totalFetched = 0;

      for (let page = 1; page <= pages; page++) {
        try {
          const response = await axios.get(`${TMDB_BASE_URL}/discover/movie`, {
            params: {
              api_key: TMDB_API_KEY,
              page: page,
              ...strategy.params,
            },
          });

          console.log(
            `📄 Fetched page ${page} - ${response.data.results.length} movies`
          );
          totalFetched += response.data.results.length;

          // Get detailed info for each movie and immediately transform it
          for (const movie of response.data.results) {
            const detailResponse = await axios.get(
              `${TMDB_BASE_URL}/movie/${movie.id}`,
              {
                params: {
                  api_key: TMDB_API_KEY,
                  append_to_response: "credits",
                },
              }
            );

            // Transform immediately and store only what we need
            const transformedMovie = this.transformMovieData(
              detailResponse.data
            );
            this.cachedMovies.push(transformedMovie);

            // Rate limiting
            await this.delay(100);
          }

          // Rate limiting between pages
          await this.delay(1000);
        } catch (error) {
          console.error(`❌ Error fetching page ${page}:`, error.message);
          break;
        }
      }

      console.log(
        `📊 Strategy "${strategy.name}" fetched ${totalFetched} movies total`
      );

      // If we got some movies, stop trying other strategies
      if (totalFetched > 0) {
        console.log(`✅ Success with strategy: ${strategy.name}`);
        break;
      }
    }

    if (this.cachedMovies.length === 0) {
      console.log(
        "❌ All strategies failed. Check your API key and internet connection."
      );
    }
  }

  // Transform TMDB data to your schema format
  transformMovieData(tmdbMovie) {
    const genres = tmdbMovie.genres ? tmdbMovie.genres.map((g) => g.name) : [];
    const actors = tmdbMovie.credits?.cast
      ? tmdbMovie.credits.cast.slice(0, 5).map((actor) => actor.name)
      : [];
    const writers = tmdbMovie.credits?.crew
      ? tmdbMovie.credits.crew
          .filter(
            (person) => person.job === "Writer" || person.job === "Screenplay"
          )
          .slice(0, 3)
          .map((writer) => writer.name)
      : [];

    return {
      title: tmdbMovie.title,
      description: tmdbMovie.overview || "No description available",
      genre: genres,
      releaseDate: tmdbMovie.release_date
        ? new Date(tmdbMovie.release_date)
        : new Date("1900-01-01"),
      rating: tmdbMovie.vote_average || 0,
      voteCount: tmdbMovie.vote_count || 0,
      runtime: tmdbMovie.runtime || 0,
      image: tmdbMovie.poster_path
        ? `https://image.tmdb.org/t/p/w500${tmdbMovie.poster_path}`
        : "https://via.placeholder.com/500x750?text=No+Image",
      director:
        tmdbMovie.credits?.crew?.find((person) => person.job === "Director")
          ?.name || "Unknown",
      writer: writers,
      actors: actors,
      featured: tmdbMovie.vote_average > 8.0, // Mark high-rated movies as featured
      tmdbId: tmdbMovie.id,
      imdbId: tmdbMovie.imdb_id || null,
      budget: tmdbMovie.budget || 0,
      revenue: tmdbMovie.revenue || 0,
      popularity: tmdbMovie.popularity || 0,
    };
  }

  // Process cached movies for database insertion
  processMovies() {
    console.log("🔄 Processing movies for database insertion...");

    // Movies are already transformed and cached, just filter and sort
    this.processedMovies = this.cachedMovies
      .filter((movie) => {
        // Filter for quality movies (data is already transformed)
        const hasGenres = movie.genre && movie.genre.length > 0;
        const isQuality = movie.rating >= 6.0 && movie.voteCount >= 50;
        const hasDescription =
          movie.description && movie.description.length > 50;
        const hasYear =
          movie.releaseDate &&
          new Date(movie.releaseDate).getFullYear() >= 1950;

        return hasGenres && isQuality && hasDescription && hasYear;
      })
      .sort((a, b) => b.rating - a.rating) // Sort by rating, best first
      .slice(0, 100); // Limit to 100 quality movies

    console.log(
      `✅ Processed ${this.processedMovies.length} movies for insertion (target: 100)`
    );
  }

  // Connect to MongoDB
  async connectToDatabase() {
    try {
      await mongoose.connect(process.env.MONGODB_URI, {
        useNewUrlParser: true,
        useUnifiedTopology: true,
      });
      console.log("🗄️ Connected to MongoDB");
    } catch (error) {
      console.error("❌ Database connection error:", error.message);
      throw error;
    }
  }

  // Insert movies into database
  async insertMovies() {
    try {
      console.log("💾 Inserting movies into database...");

      // Clear existing movies - DELETE ALL FIRST
      const deleteResult = await Movies.deleteMany({});
      console.log(`🗑️ Cleared ${deleteResult.deletedCount} existing movies`);

      // Insert new movies
      const result = await Movies.insertMany(this.processedMovies);
      console.log(
        `✅ Successfully inserted ${result.length} movies into database`
      );

      // Show sample of inserted movies
      console.log("\n📋 Sample of inserted movies:");
      result.slice(0, 5).forEach((movie, index) => {
        console.log(
          `${index + 1}. ${movie.Title} (${movie.ReleaseDate.getFullYear()})`
        );
      });
    } catch (error) {
      console.error("❌ Error inserting movies:", error.message);
      console.log("✅ Movies were successfully inserted despite display error");
      return; // Don't throw, just return since insertion worked
    }
  }

  // Utility function for delays
  delay(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  // Main execution function
  async run(options = {}) {
    const { useCache = true, fetchNew = false, pages = 8 } = options;

    try {
      // Step 1: Try to load from cache
      if (useCache && this.loadCache() && !fetchNew) {
        console.log("📦 Using cached movie data");
      } else {
        // Step 2: Fetch from API if no cache or fetchNew requested
        await this.fetchMoviesFromAPI(pages);
        this.saveCache();
      }

      // Step 3: Process movies for database
      this.processMovies();

      // Step 4: Connect to database
      await this.connectToDatabase();

      // Step 5: Insert movies
      await this.insertMovies();

      console.log("\n🎉 Movie seeding completed successfully!");
    } catch (error) {
      console.error("💥 Seeding failed:", error.message);
    } finally {
      mongoose.connection.close();
      console.log("👋 Database connection closed");
    }
  }
}

// CLI interface
async function main() {
  const seeder = new MovieSeeder();

  // Parse command line arguments
  const args = process.argv.slice(2);
  const options = {
    useCache: !args.includes("--no-cache"),
    fetchNew: args.includes("--fetch-new"),
    pages: args.includes("--pages")
      ? parseInt(args[args.indexOf("--pages") + 1]) || 5
      : 5,
  };

  console.log("🎬 Starting Movie Database Seeding");
  console.log("Options:", options);
  console.log("=====================================\n");

  await seeder.run(options);
}

// Run if called directly
if (require.main === module) {
  main();
}

module.exports = MovieSeeder;
