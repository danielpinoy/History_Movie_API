const express = require("express"),
  morgan = require("morgan"),
  bodyParser = require("body-parser");
const rateLimit = require("express-rate-limit"); // Move this up here

const { check, validationResult } = require("express-validator");

const mongoose = require("mongoose");
Models = require("./model.js");

const Movies = Models.Movie;
const Users = Models.User;

// Create rate limiters
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: "Too many requests from this IP, please try again after 15 minutes",
  standardHeaders: true,
  legacyHeaders: false,
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 50,
  message:
    "Too many login attempts from this IP, please try again after 15 minutes",
  standardHeaders: true,
  legacyHeaders: false,
});

const movieLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 200,
  message: "Too many movie requests, please try again later",
  standardHeaders: true,
  legacyHeaders: false,
});

// Apply it before your movie routes
// app.use("/Movies", movieLimiter);

// TEST LOCALLY
mongoose
  .connect(
    "mongodb+srv://railway_movie_api:OeS710kIwld2zsUS@historicmovies.wzmwehq.mongodb.net/historicMovies?retryWrites=true&w=majority&appName=historicMovies",
    {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    }
  )
  .then(() => {
    console.log("Connected to the database.");
  })
  .catch((err) => {
    console.error("Database connection error:", err);
  });

// process.env.CONNECTION_URI from heruko
// mongoose
//   .connect(process.env.CONNECTION_URI, {
//     useNewUrlParser: true,
//     useUnifiedTopology: true,
//   })
//   .then(() => {
//     console.log("Connected to the database.");
//   })
//   .catch((err) => {
//     console.error("Database connection error:", err);
//   });

const app = express();

// Apply limiters immediately after creating the app
app.use(apiLimiter);
app.use("/login", authLimiter);
app.use("/register", authLimiter);
app.use("/Movies", movieLimiter);

//CORS
const cors = require("cors");
let allowedOrigins = [
  "http://localhost:8080",
  "http://localhost:3000",
  "http://testsite.com",
  "http://localhost:1234",
  "https://kaleidoscopic-tiramisu-9e52da.netlify.app",
  "http://localhost:4200",
  "https://my-flix-client-37ln36u1h-danielpinoys-projects.vercel.app",
  "https://my-flix-client-7o9x-dk8ca42tz-danielpinoys-projects.vercel.app",
  "https://my-flix-client-7o9x.vercel.app",
  "https://history-movie-api.vercel.app",
  "https://my-flix-client-ashen.vercel.app/myFlixClient",
];

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin) return callback(null, true);
      if (allowedOrigins.indexOf(origin) === -1) {
        // If a specific origin isn’t found on the list of allowed origins
        let message =
          "The CORS policy for this application doesn’t allow access from origin " +
          origin;
        return callback(new Error(message), false);
      }
      return callback(null, true);
    },
  })
);

app.use(bodyParser.json());

let auth = require("./auth")(app);
const passport = require("passport");
require("./passport");

// Everything in the public folder will be served
app.use(express.static("public"));

// logs in http request into terminal
app.use(morgan("common"));

// Routes
app.get("/", (req, res) => {
  res.send("Welcome to my library of Historic Movies");
});

app.get("/documentation", (req, res) => {
  const filePath = "public/documentation.html";
  res.sendFile(filePath, { root: __dirname });
});

/**
 * ************************************************************
 *                           USERS
 * ************************************************************
 */

// User Routes

//
app.get(
  "/Users",
  passport.authenticate("jwt", { session: false }),
  async (req, res) => {
    Users.find()
      .then((Users) => {
        res.status(200).json(Users);
      })
      .catch((error) => {
        console.error("Mongoose query error:", error);
        res.status(500).send("Error: " + error);
      });
  }
);

// Add new user
app.post(
  "/register",
  [
    check("Username", "Username is required").isLength({ min: 5 }),
    check(
      "Username",
      "Username contains non alphanumeric characters - not allowed."
    )
      .matches(/^[a-zA-Z0-9 ]*$/)
      .withMessage("Username can only contain letters, numbers, and spaces")
      .not()
      .isEmpty(),
    check("Password", "Password is required").not().isEmpty(),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(422).json({ errors: errors.array() });
    }

    try {
      const hashedPassword = Users.hashPassword(req.body.Password);
      const existingUser = await Users.findOne({ Username: req.body.Username });

      if (existingUser) {
        return res
          .status(400)
          .json({ error: `Username "${req.body.Username}" already exists` });
      }

      const newUser = await Users.create({
        Username: req.body.Username,
        Password: hashedPassword, // Use the hashed password here
        Email: req.body.Email,
        Birthday: req.body.Birthday,
      });
      console.log("New user created:", newUser);
      res.status(201).json(newUser);
    } catch (error) {
      console.error(error);
      res.status(500).send("Error: " + error);
    }
  }
);

// Update User
app.put(
  "/user/:Username",
  [
    check("Username", "Username is required").isLength({ min: 5 }),
    check(
      "Username",
      "Username contains non alphanumeric characters - not allowed."
    )
      .matches(/^[a-zA-Z0-9 ]*$/)
      .withMessage("Username can only contain letters, numbers, and spaces")
      .not()
      .isEmpty(),
    check("Password", "Password is required").not().isEmpty(),
    check("Email", "Email does not appear to be valid").isEmail(),
  ],
  passport.authenticate("jwt", { session: false }),
  async (req, res) => {
    console.log("PUT request received for Username:", req.params.Username);

    let errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(422).json({ errors: errors.array() });
    }

    const updateData = {
      Username: req.body.Username,
      Email: req.body.Email,
      Birthday: req.body.Birthday,
    };

    // Only hash and update the password if a new password is provided
    if (req.body.Password) {
      updateData.Password = Users.hashPassword(req.body.Password);
    }

    await Users.findOneAndUpdate(
      { Username: req.params.Username },
      { $set: updateData },
      { new: true }
    )
      .then((updatedUser) => {
        res.json(updatedUser);
      })
      .catch((err) => {
        console.error(err);
        res.status(500).send("Error: " + err);
      });
  }
);

// Get user profile
app.get(
  "/user/:Username",
  passport.authenticate("jwt", { session: false }),
  async (req, res) => {
    Users.findOne({ Username: req.params.Username })
      .select("-Password") // Exclude the password field from the query result
      .then((user) => {
        if (user) {
          res.status(200).json(user);
        } else {
          res.status(404).send("User not found");
        }
      })
      .catch((error) => {
        console.error("Mongoose query error:", error);
        res.status(500).send("Error: " + error);
      });
  }
);

// Change password
app.put(
  "/user/:Username/change-password",
  passport.authenticate("jwt", { session: false }),
  async (req, res) => {
    const { currentPassword, newPassword } = req.body;

    Users.findOne({ Username: req.params.Username })
      .then(async (user) => {
        if (!user) {
          return res.status(404).json({ message: "User not found" });
        }

        const isPasswordValid = await user.validatePassword(currentPassword);
        if (!isPasswordValid) {
          return res.status(401).json({ message: "Invalid current password" });
        }

        user.Password = Users.hashPassword(newPassword);
        await user.save();

        res.status(200).json({ message: "Password changed successfully" });
      })
      .catch((error) => {
        console.error("Error changing password:", error);
        res.status(500).json({ error: "Internal server error" });
      });
  }
);

// add favorite movie to user
app.post(
  "/user/addfavorite",
  passport.authenticate("jwt", { session: false }),
  async (req, res) => {
    const { userId, movieId } = req.body;

    Users.findByIdAndUpdate(
      userId,
      { $addToSet: { FavoriteMovies: movieId } },
      { new: true }
    )
      .then((updatedUser) => {
        if (!updatedUser) {
          return res.status(404).json({ message: "User not found" });
        }
        res.status(200).json(updatedUser);
      })
      .catch((error) => {
        console.error("Error adding favorite movie:", error);
        res.status(500).json({ error: "Internal server error" });
      });
  }
);

// Delete
app.delete(
  "/user/:id/:movieId",
  passport.authenticate("jwt", { session: false }),
  async (req, res) => {
    const { id, movieId } = req.params;

    Users.updateOne({ _id: id }, { $pull: { FavoriteMovies: movieId } })
      .then((updateResult) => {
        if (updateResult.nModified === 0) {
          return res
            .status(404)
            .json({ message: "User not found or movie not in favorites." });
        }
        res.status(200).json({ message: "Movie removed from favorites." });
      })
      .catch((error) => {
        console.error("Error removing movie from favorites:", error);
        res.status(500).json({ error: "Internal server error" });
      });
  }
);

// Delete
app.delete(
  "/user/:id",
  passport.authenticate("jwt", { session: false }),
  async (req, res) => {
    const { id } = req.params;
    Users.findOneAndRemove({ _id: id })
      .then((deletedUser) => {
        // Use the correct variable name here
        if (!deletedUser) {
          res.status(404).json({ error: "User Not Found" }); // Adjust the status code to 404 for "Not Found"
        } else {
          console.log("User deleted:", deletedUser);
          res.status(200).json({ message: "User deleted successfully" });
        }
      })
      .catch((error) => {
        console.error("Error deleting user:", error);
        res.status(500).json({ error: "Internal server error" });
      });
  }
);

/**
 * ************************************************************
 *                           MOVIES
 * ************************************************************
 */

// get all movies
app.get(
  "/Movies",
  passport.authenticate("jwt", { session: false }),
  async (req, res) => {
    await Movies.find()
      .then((movies) => {
        res.status(201).json(movies);
      })
      .catch((error) => {
        console.error("Mongoose query error:", error);
        res.status(500).send("Error: " + error);
      });
  }
);

// return movie by title
app.get(
  "/Movies/:Title",
  passport.authenticate("jwt", { session: false }),
  async (req, res) => {
    Movies.findOne({ Title: req.params.Title })
      .then((movie) => {
        if (movie) {
          res.status(201).json(movie);
        } else {
          res.status(500).send("Movie not found");
        }
      })
      .catch((error) => {
        console.error("Mongoose query error:", error);
        res.status(500).send("Error: " + error);
      });
  }
);

// return movie by genre
app.get(
  "/Movies/genres/:Genre",
  passport.authenticate("jwt", { session: false }),
  async (req, res) => {
    Movies.find({ "Genre.Name": req.params.Genre })
      .then((movie) => {
        res.status(201).json(movie);
      })
      .catch((error) => {
        console.error("Mongoose query error:", error);
        res.status(500).send("Error: " + error);
      });
  }
);

// return director by name
app.get(
  "/Movies/Director/:Name",
  passport.authenticate("jwt", { session: false }),
  async (req, res) => {
    Movies.find({ "Director.Name": req.params.Name })
      .then((movie) => {
        const Director = movie[0].Director;
        res.status(201).json(Director);
      })
      .catch((error) => {
        console.error("Mongoose query error:", error);
        res.status(500).send("Error: " + error);
      });
  }
);

// Temporary test endpoint
app.get("/test-error", (req, res, next) => {
  const error = new Error("Test error");
  error.code = "ECONNREFUSED";
  next(error);
});

// Update the error handling middleware
app.use((err, req, res, next) => {
  // MongoDB errors
  if (err.name === "MongoNetworkError" || err.name === "MongoTimeoutError") {
    return res.status(503).json({
      message: "Database connection error. Please try again later.",
    });
  }

  // Network errors
  if (err.code === "ECONNREFUSED" || err.code === "ENOTFOUND") {
    return res.status(503).json({
      message: "Network error: Server is unreachable. Please try again later.",
    });
  }

  // Timeout errors
  if (err.code === "ETIMEDOUT") {
    return res.status(504).json({
      message: "Request timed out. Please try again later.",
    });
  }

  // Authentication errors
  if (err.name === "UnauthorizedError") {
    return res.status(401).json({
      message: "Invalid credentials",
    });
  }

  // Validation errors
  if (err.name === "ValidationError") {
    return res.status(400).json({
      message: err.message || "Invalid input data",
    });
  }

  // Default error
  console.error(err.stack);
  res.status(500).json({
    message: "Something went wrong. Please try again later.",
  });
});

// // Error Handling Middleware
// app.use((err, req, res, next) => {
//   console.error(err.stack);
//   res.status(500).send("Internal Server Error");
// });

const port = process.env.PORT || 8080;
app.listen(port, "0.0.0.0", () => {
  console.log("Listening on Port " + port);
});
