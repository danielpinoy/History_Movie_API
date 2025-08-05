require("dotenv").config();
const axios = require("axios");
const fs = require("fs");
const mongoose = require("mongoose");
const Models = require("./model.js");
const Movies = Models.Movie;

const TMDB_API_KEY = process.env.TMDB_API_KEY;
const TMDB_BASE_URL = "https://api.themoviedb.org/3";
const CACHE_FILE = "./cached_movies.json";

// Cloudinary
const CLOUDINARY_CLOUD_NAME = "diuwbgio8";

// Image optimization function
const createOptimizedImageUrl = (originalUrl, width = 300, height = 450) => {
  if (!originalUrl) {
    return `https://via.placeholder.com/${width}x${height}/1a1a1a/ffffff?text=No+Image`;
  }

  const encodedUrl = encodeURIComponent(originalUrl);
  return `https://res.cloudinary.com/${CLOUDINARY_CLOUD_NAME}/image/fetch/w_${width},h_${height},c_fill,f_auto,q_auto/${encodedUrl}`;
};

class MovieSeeder {
  constructor() {
    this.allMovies = [];
    this.filteredMovies = [];
  }

  // Utility function for delays
  delay(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  // Fetch movies from multiple strategies
  async fetchAllMovies(maxPages = 25) {
    console.log(
      `🔍 Fetching movies from TMDB API (${maxPages} pages per strategy)...`
    );

    const strategies = [
      {
        name: "Popular English Historical Movies",
        params: {
          with_genres: "18,36,10752", // Drama, History, War
          with_original_language: "en", // English only
          region: "US,GB,CA,AU", // English-speaking countries
          sort_by: "popularity.desc",
          "vote_average.gte": 6.0,
          include_adult: false,
        },
      },
      {
        name: "Top Rated Historical & War Movies",
        params: {
          with_genres: "36,10752", // History, War ONLY (no general drama)
          with_original_language: "en", // English only
          region: "US,GB,CA,AU", // English-speaking countries
          sort_by: "vote_average.desc",
          "vote_count.gte": 100,
          "vote_average.gte": 7.0,
          include_adult: false,
        },
      },
      {
        name: "Historical Biographical Movies",
        params: {
          with_genres: "18,36", // Drama + History TOGETHER (not just drama)
          with_original_language: "en", // English only
          region: "US,GB,CA,AU", // English-speaking countries
          sort_by: "popularity.desc",
          "vote_average.gte": 6.5,
          "primary_release_date.gte": "1990-01-01",
          include_adult: false,
        },
      },
      {
        name: "Period Dramas & Historical Fiction",
        params: {
          with_genres: "18,36,10749", // Drama + History + Romance (period pieces)
          with_original_language: "en", // English only
          region: "US,GB,CA,AU", // English-speaking countries
          sort_by: "vote_average.desc",
          "primary_release_date.gte": "1980-01-01",
          "vote_average.gte": 6.8,
          include_adult: false,
        },
      },
    ];

    for (const strategy of strategies) {
      console.log(`\n🎯 Strategy: ${strategy.name}`);
      let moviesFromStrategy = 0;

      for (let page = 1; page <= maxPages; page++) {
        try {
          console.log(`📄 Fetching page ${page}/${maxPages}...`);

          const response = await axios.get(`${TMDB_BASE_URL}/discover/movie`, {
            params: {
              api_key: TMDB_API_KEY,
              page: page,
              ...strategy.params,
            },
          });

          const movies = response.data.results || [];
          console.log(`   Found ${movies.length} movies on page ${page}`);
          moviesFromStrategy += movies.length;

          // Process each movie
          for (const movie of movies) {
            try {
              // Get detailed movie info
              const detailResponse = await axios.get(
                `${TMDB_BASE_URL}/movie/${movie.id}`,
                {
                  params: {
                    api_key: TMDB_API_KEY,
                    append_to_response: "credits",
                  },
                }
              );

              const processedMovie = this.processMovieData(detailResponse.data);
              this.allMovies.push(processedMovie);

              // Rate limiting to avoid hitting API limits
              await this.delay(50);
            } catch (error) {
              console.log(
                `   ⚠️ Error processing movie ${movie.title}: ${error.message}`
              );
            }
          }

          // Rate limiting between pages
          await this.delay(500);
        } catch (error) {
          console.log(`   ❌ Error fetching page ${page}: ${error.message}`);
          break;
        }
      }

      console.log(
        `✅ Strategy "${strategy.name}" completed: ${moviesFromStrategy} movies fetched`
      );

      // Stop if we have enough movies
      if (this.allMovies.length >= 300) {
        console.log(
          `🎯 Reached ${this.allMovies.length} movies, stopping fetch`
        );
        break;
      }
    }

    console.log(`\n📊 Total movies fetched: ${this.allMovies.length}`);
  }

  processMovieData(tmdbMovie) {
    // Extract basic info
    const genres = tmdbMovie.genres ? tmdbMovie.genres.map((g) => g.name) : [];
    const actors = tmdbMovie.credits?.cast
      ? tmdbMovie.credits.cast.slice(0, 5).map((actor) => actor.name)
      : [];
    const director =
      tmdbMovie.credits?.crew?.find((person) => person.job === "Director")
        ?.name || "Unknown";

    // Get TMDB image paths
    const posterPath = tmdbMovie.poster_path;
    const backdropPath = tmdbMovie.backdrop_path;

    // Generate different sized image URLs using your existing Cloudinary function
    const posterUrl = posterPath
      ? `https://image.tmdb.org/t/p/w780${posterPath}`
      : null;
    const backdropUrl = backdropPath
      ? `https://image.tmdb.org/t/p/w1280${backdropPath}`
      : null;

    // Create images object with multiple sizes
    const images = {
      // Thumbnail for grid cards (300x450) - good for performance
      thumbnail: createOptimizedImageUrl(posterUrl, 300, 450),

      // Poster for detailed views (500x750) - balanced quality
      poster: createOptimizedImageUrl(posterUrl, 500, 750),

      // Backdrop for hero sections - use backdrop if available, otherwise poster
      backdrop: backdropUrl
        ? createOptimizedImageUrl(backdropUrl, 800, 450) // Wide format for hero
        : createOptimizedImageUrl(posterUrl, 600, 800), // Tall format fallback

      // Original for future use (large poster)
      original: createOptimizedImageUrl(posterUrl, 780, 1170),
    };

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

      // New structured images object
      images: images,

      // Legacy field for backward compatibility (use poster size)
      image: images.poster,

      // Keep your existing heroImage for compatibility
      heroImage: images.backdrop,

      director: director,
      writer: [],
      actors: actors,
      featured: tmdbMovie.vote_average > 8.0,
      tmdbId: tmdbMovie.id,
      imdbId: tmdbMovie.imdb_id || null,
      budget: tmdbMovie.budget || 0,
      revenue: tmdbMovie.revenue || 0,
      popularity: tmdbMovie.popularity || 0,
    };
  }

  // Remove duplicates and filter movies
  processMovies() {
    console.log(`\n🔄 Processing ${this.allMovies.length} movies...`);

    // Remove duplicates based on tmdbId
    const uniqueMovies = [];
    const seenIds = new Set();

    for (const movie of this.allMovies) {
      if (!seenIds.has(movie.tmdbId)) {
        seenIds.add(movie.tmdbId);
        uniqueMovies.push(movie);
      }
    }

    console.log(
      `✅ Removed ${this.allMovies.length - uniqueMovies.length} duplicates`
    );
    console.log(`📊 ${uniqueMovies.length} unique movies remaining`);

    // Apply RELAXED filtering
    this.filteredMovies = uniqueMovies.filter((movie) => {
      // Very relaxed criteria to get more movies
      const hasTitle = movie.title && movie.title.length > 0;
      const hasGenres = movie.genre && movie.genre.length > 0;
      const hasDescription = movie.description && movie.description.length > 10; // Very short requirement
      const hasValidYear =
        movie.releaseDate && new Date(movie.releaseDate).getFullYear() >= 1900; // Very old requirement
      const hasMinimalRating = movie.rating >= 4.0; // Low rating requirement
      const hasImage = movie.image && movie.image.includes("cloudinary");

      // Debug logging for filtering
      if (!hasTitle) console.log(`❌ No title: ${movie.title}`);
      if (!hasGenres) console.log(`❌ No genres: ${movie.title}`);
      if (!hasDescription) console.log(`❌ No description: ${movie.title}`);
      if (!hasValidYear)
        console.log(
          `❌ Bad year: ${movie.title} (${new Date(
            movie.releaseDate
          ).getFullYear()})`
        );
      if (!hasMinimalRating)
        console.log(`❌ Low rating: ${movie.title} (${movie.rating})`);
      if (!hasImage) console.log(`❌ No image: ${movie.title}`);

      return (
        hasTitle &&
        hasGenres &&
        hasDescription &&
        hasValidYear &&
        hasMinimalRating &&
        hasImage
      );
    });

    // Sort by popularity and rating
    this.filteredMovies.sort((a, b) => {
      const scoreA = a.rating * 0.7 + Math.log(a.popularity) * 0.3;
      const scoreB = b.rating * 0.7 + Math.log(b.popularity) * 0.3;
      return scoreB - scoreA;
    });

    // Take top movies
    this.filteredMovies = this.filteredMovies.slice(0, 150);

    console.log(`✅ Final filtered movies: ${this.filteredMovies.length}`);

    // Show sample movies
    if (this.filteredMovies.length > 0) {
      console.log("\n🎬 Sample movies to be inserted:");
      this.filteredMovies.slice(0, 5).forEach((movie, index) => {
        console.log(
          `${index + 1}. ${movie.title} (${new Date(
            movie.releaseDate
          ).getFullYear()}) - Rating: ${movie.rating}`
        );
      });
    } else {
      console.log("❌ NO MOVIES PASSED FILTERING! Check the criteria.");
    }
  }

  // Connect to database
  async connectToDatabase() {
    try {
      await mongoose.connect(process.env.MONGODB_URI, {
        useNewUrlParser: true,
        useUnifiedTopology: true,
      });
      console.log("\n🗄️ Connected to MongoDB");
    } catch (error) {
      console.error("❌ Database connection error:", error.message);
      throw error;
    }
  }

  // Insert movies into database
  async insertMovies() {
    try {
      console.log("💾 Inserting movies into database...");

      // Clear existing movies
      const deleteResult = await Movies.deleteMany({});
      console.log(`🗑️ Cleared ${deleteResult.deletedCount} existing movies`);

      if (this.filteredMovies.length === 0) {
        console.log("❌ No movies to insert!");
        return;
      }

      // Insert new movies
      let successCount = 0;
      let errorCount = 0;

      for (const movie of this.filteredMovies) {
        try {
          await Movies.create(movie);
          successCount++;

          // Show progress
          if (successCount % 20 === 0) {
            console.log(
              `   Inserted ${successCount}/${this.filteredMovies.length} movies...`
            );
          }
        } catch (error) {
          console.log(`⚠️ Error inserting "${movie.title}": ${error.message}`);
          errorCount++;
        }
      }

      console.log(`\n✅ Successfully inserted ${successCount} movies`);
      if (errorCount > 0) {
        console.log(`⚠️ Failed to insert ${errorCount} movies`);
      }

      // Show final sample
      const sampleMovies = await Movies.find().limit(3);
      console.log("\n📋 Sample inserted movies:");
      sampleMovies.forEach((movie, index) => {
        console.log(
          `${index + 1}. ${movie.title} (${movie.releaseDate.getFullYear()})`
        );
        console.log(`   Image: ${movie.image.substring(0, 80)}...`);
      });
    } catch (error) {
      console.error("❌ Error inserting movies:", error.message);
      throw error;
    }
  }

  // Main execution
  async run(options = {}) {
    const { pages = 25 } = options;

    try {
      console.log("🎬 FRESH Movie Database Seeding Started");
      console.log(`🖼️ Using Cloudinary cloud: ${CLOUDINARY_CLOUD_NAME}`);
      console.log(`📄 Will fetch ${pages} pages per strategy`);
      console.log("=====================================\n");

      // Step 1: Fetch movies from TMDB
      await this.fetchAllMovies(pages);

      // Step 2: Process and filter movies
      this.processMovies();

      // Step 3: Connect to database
      await this.connectToDatabase();

      // Step 4: Insert movies
      await this.insertMovies();

      console.log("\n🎉 Movie seeding completed successfully!");
      console.log(
        `✅ ${this.filteredMovies.length} movies with optimized images ready!`
      );
    } catch (error) {
      console.error("\n💥 Seeding failed:", error.message);
      console.error(error.stack);
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
    pages: args.includes("--pages")
      ? parseInt(args[args.indexOf("--pages") + 1]) || 25
      : 25,
    fetchNew: args.includes("--fetch-new"),
    noCache: args.includes("--no-cache"),
  };

  console.log("🎬 Starting Fresh Movie Seeding");
  console.log("Options:", options);
  console.log("=====================================\n");

  await seeder.run(options);
}

// Run if called directly
if (require.main === module) {
  main();
}

module.exports = MovieSeeder;
