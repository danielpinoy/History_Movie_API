// Updated model.js
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");

let movieSchema = mongoose.Schema(
  {
    title: { type: String, required: true, trim: true, index: true },
    description: { type: String, required: true, trim: true },
    genre: [{ type: String, trim: true }],
    releaseDate: { type: Date, required: true, index: true },
    rating: { type: Number, min: 0, max: 10 },
    voteCount: { type: Number, min: 0 },
    runtime: { type: Number, min: 1 },

    // ENHANCED IMAGE FIELDS:
    images: {
      // For movie cards (300x450)
      thumbnail: { type: String, required: true },

      // For detailed views and featured cards (780x1170)
      poster: { type: String, required: true },

      // For hero sections and backgrounds (1280x720)
      backdrop: { type: String },

      // Original high-res version for future use
      original: { type: String },
    },

    // Legacy field for backward compatibility (can remove later)
    image: { type: String, required: true },

    director: { type: String, required: true, trim: true },
    writer: [{ type: String, trim: true }],
    actors: [{ type: String, trim: true }],
    featured: { type: Boolean, default: false },

    // TMDB references
    tmdbId: { type: Number, unique: true, sparse: true },
    imdbId: { type: String, sparse: true },
    budget: { type: Number, min: 0 },
    revenue: { type: Number, min: 0 },
    popularity: { type: Number, min: 0 },
  },
  {
    timestamps: true,
  }
);

// Add text search index
movieSchema.index({ title: "text", description: "text" });

// Keep your existing user schema unchanged
let userSchema = mongoose.Schema({
  Username: { type: String, required: true },
  Password: { type: String, required: true },
  Email: { type: String, required: true },
  Birthday: Date,
  FavoriteMovies: [{ type: mongoose.Schema.Types.ObjectId, ref: "Movie" }],
});

userSchema.statics.hashPassword = (password) => {
  return bcrypt.hashSync(password, 10);
};

userSchema.methods.validatePassword = function (password) {
  return bcrypt.compareSync(password, this.Password);
};

let Movie = mongoose.model("Movie", movieSchema);
let User = mongoose.model("User", userSchema);

module.exports.Movie = Movie;
module.exports.User = User;
