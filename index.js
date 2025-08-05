require("dotenv").config();

const express = require("express"),
  morgan = require("morgan"),
  bodyParser = require("body-parser");
const rateLimit = require("express-rate-limit");
const { check, validationResult } = require("express-validator");
const mongoose = require("mongoose");

Models = require("./model.js");
const Movies = Models.Movie;
const Users = Models.User;

// Create rate limiters
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 300,
  message: "Too many requests from this IP, please try again after 15 minutes",
  standardHeaders: true,
  legacyHeaders: false,
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 30,
  message:
    "Too many login attempts from this IP, please try again after 15 minutes",
  standardHeaders: true,
  legacyHeaders: false,
});
const movieLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 600,
  message: "Too many movie requests, please try again later",
  standardHeaders: true,
  legacyHeaders: false,
});

// MongoDB Connection
mongoose
  .connect(process.env.MONGODB_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  })
  .then(() => {
    console.log("Connected to the database.");
  })
  .catch((err) => {
    console.error("Database connection error:", err);
  });

const app = express();

app.use(apiLimiter);
app.use("/login", authLimiter);
app.use("/register", authLimiter);
app.use("/Movies", movieLimiter);

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
  "https://main.digy0dhpvav3e.amplifyapp.com",
];

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin) return callback(null, true);
      if (allowedOrigins.indexOf(origin) === -1) {
        let message =
          "The CORS policy for this application doesn't allow access from origin " +
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

app.use(express.static("public"));
app.use(morgan("common"));

// Routes
app.get("/", (req, res) => {
  res.send("Welcome to my library of Historic Movies");
});

app.get("/documentation", (req, res) => {
  const filePath = "public/documentation.html";
  res.sendFile(filePath, { root: __dirname });
});

// User Routes
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
        return res.status(400).json({
          error: `Username "${req.body.Username}" already exists`,
        });
      }

      const newUser = await Users.create({
        Username: req.body.Username,
        Password: hashedPassword,
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

app.put(
  "/user/:Username",
  [
    check("Username", "Username is required").isLength({ min: 5 }),
    check(
      "Username",
      "Username contains non alphanumeric characters - not allowed."
    ).matches(/^[a-zA-Z0-9 ]*$/),
    check("Email", "Email does not appear to be valid").isEmail(),
  ],
  passport.authenticate("jwt", { session: false }),
  async (req, res) => {
    // console.log("PUT request received for Username:", req.params.Username);

    let errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(422).json({ errors: errors.array() });
    }

    const updateData = {
      Username: req.body.Username,
      Email: req.body.Email,
      Birthday: req.body.Birthday,
    };

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

app.get(
  "/user/:Username",
  passport.authenticate("jwt", { session: false }),
  async (req, res) => {
    Users.findOne({ Username: req.params.Username })
      .select("-Password")
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

app.put(
  "/user/:Username/change-password",
  passport.authenticate("jwt", { session: false }),
  async (req, res) => {
    const { currentPassword, newPassword } = req.body;

    try {
      const user = await Users.findOne({ Username: req.params.Username });

      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      const isPasswordValid = await user.validatePassword(currentPassword);
      if (!isPasswordValid) {
        return res.status(400).json({ message: "Invalid current password" });
      }

      user.Password = Users.hashPassword(newPassword);
      await user.save();

      res.status(200).json({ message: "Password changed successfully" });
    } catch (error) {
      console.error("Error changing password:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  }
);

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

app.delete(
  "/user/:id/:movieId",
  passport.authenticate("jwt", { session: false }),
  async (req, res) => {
    const { id, movieId } = req.params;

    Users.findByIdAndUpdate(
      id,
      { $pull: { FavoriteMovies: movieId } },
      { new: true }
    )
      .then((updatedUser) => {
        if (!updatedUser) {
          return res.status(404).json({ message: "User not found" });
        }
        res.status(200).json(updatedUser);
      })
      .catch((error) => {
        console.error("Error removing movie from favorites:", error);
        res.status(500).json({ error: "Internal server error" });
      });
  }
);

app.delete(
  "/user/:id",
  passport.authenticate("jwt", { session: false }),
  async (req, res) => {
    const { id } = req.params;
    Users.findOneAndRemove({ _id: id })
      .then((deletedUser) => {
        if (!deletedUser) {
          res.status(404).json({ error: "User Not Found" });
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

// Movie Routes
app.get(
  "/Movies",
  passport.authenticate("jwt", { session: false }),
  async (req, res) => {
    await Movies.find()
      .then((movies) => {
        res.status(200).json(movies);
      })
      .catch((error) => {
        console.error("Mongoose query error:", error);
        res.status(500).send("Error: " + error);
      });
  }
);

app.get("/Movies/:Title", async (req, res) => {
  Movies.findOne({ title: req.params.Title })
    .then((movie) => {
      if (movie) {
        res.status(200).json(movie);
      } else {
        res.status(404).send("Movie not found");
      }
    })
    .catch((error) => {
      console.error("Mongoose query error:", error);
      res.status(500).send("Error: " + error);
    });
});

app.get("/Movies/genres/:Genre", async (req, res) => {
  // This one needs to be updated to handle array search
  Movies.find({ genre: { $in: [req.params.Genre] } })
    .then((movies) => {
      res.status(200).json(movies);
    })
    .catch((error) => {
      console.error("Mongoose query error:", error);
      res.status(500).send("Error: " + error);
    });
});

app.get("/Movies/Director/:Name", async (req, res) => {
  Movies.find({ director: req.params.Name }) // Changed: "Director.Name" -> director
    .then((movies) => {
      if (movies.length > 0) {
        res.status(200).json({
          name: movies[0].director,
          movies: movies.map((m) => m.title),
        });
      } else {
        res.status(404).send("Director not found");
      }
    })
    .catch((error) => {
      console.error("Mongoose query error:", error);
      res.status(500).send("Error: " + error);
    });
});

// Error Handling Middleware
app.use((err, req, res, next) => {
  if (err.name === "MongoNetworkError" || err.name === "MongoTimeoutError") {
    return res.status(503).json({
      message: "Database connection error. Please try again later.",
    });
  }

  if (err.code === "ECONNREFUSED" || err.code === "ENOTFOUND") {
    return res.status(503).json({
      message: "Network error: Server is unreachable. Please try again later.",
    });
  }

  if (err.code === "ETIMEDOUT") {
    return res.status(504).json({
      message: "Request timed out. Please try again later.",
    });
  }

  if (err.name === "UnauthorizedError") {
    return res.status(401).json({
      message: "Invalid credentials",
    });
  }

  if (err.name === "ValidationError") {
    return res.status(400).json({
      message: err.message || "Invalid input data",
    });
  }

  console.error(err.stack);
  res.status(500).json({
    message: "Something went wrong. Please try again later.",
  });
});

// Export the app for Lambda
module.exports = app;

// For local development
if (require.main === module) {
  const port = process.env.PORT || 8080;
  app.listen(port, "0.0.0.0", () => {
    console.log("Listening on Port " + port);
  });
}
