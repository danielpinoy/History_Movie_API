const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");

let movieSchema = mongoose.Schema(
  {
    title: { type: String, required: true, trim: true, index: true },
    description: { type: String, required: true, trim: true },
    genre: [{ type: String, trim: true }],
    releaseDate: { type: Date, required: true, index: true },
    rating: { type: Number, min: 0, max: 10 }, // TMDB rating 0-10
    voteCount: { type: Number, min: 0 }, // How many people rated it
    runtime: { type: Number, min: 1 }, // Minutes as number
    image: { type: String, required: true },
    director: { type: String, required: true, trim: true },
    writer: [{ type: String, trim: true }],
    actors: [{ type: String, trim: true }],
    featured: { type: Boolean, default: false },
    // New useful fields from TMDB:
    tmdbId: { type: Number, unique: true, sparse: true }, // TMDB API reference
    imdbId: { type: String, sparse: true }, // IMDB reference
    budget: { type: Number, min: 0 }, // Movie budget
    revenue: { type: Number, min: 0 }, // Box office revenue
    popularity: { type: Number, min: 0 }, // TMDB popularity score
  },
  {
    timestamps: true, // Adds createdAt, updatedAt automatically
  }
);

// Add text search index for better search performance
movieSchema.index({ title: "text", description: "text" });

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
