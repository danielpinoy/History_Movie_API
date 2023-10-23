const express = require("express"),
    morgan = require("morgan"),
    bodyParser = require("body-parser");

const { check, validationResult } = require("express-validator");

const mongoose = require("mongoose");
Models = require("./model.js");

const Movies = Models.Movie;
const Users = Models.User;

// mongoose
//     .connect("mongodb://127.0.0.1:27017/history_movies", {
//         useNewUrlParser: true,
//         useUnifiedTopology: true,
//     })
//     .then(() => {
//         console.log("Connected to the database.");
//     })
//     .catch((err) => {
//         console.error("Database connection error:", err);
//     });

// process.env.CONNECTION_URI from heruko
mongoose
    .connect(process.env.CONNECTION_URI, {
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

//CORS
const cors = require("cors");
app.use(
    cors({
        origin: (origin, callback) => {
            if (!origin) return callback(null, true);
            if (allowedOrigins.indexOf(origin) === -1) {
                // If a specific origin isn't found on the list of allowed origins
                let message =
                    " The CORS policy for this application doesn't allow access from origin " +
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

// users = [{ id: 1, username: "Daniel", password: "123", favoriteMovies: [] }];

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

// User Routes
app.get("/Users", passport.authenticate("jwt", { session: false }), async (req, res) => {
    Users.find()
        .then((Users) => {
            res.status(200).json(Users);
        })
        .catch((error) => {
            console.error("Mongoose query error:", error);
            res.status(500).send("Error: " + error);
        });
});

// Add new user
app.post(
    "/register",
    [
        check("Username", "Username is required").isLength({ min: 5 }),
        check(
            "Username",
            "Username contains non alphanumeric characters - not allowed."
        ).isAlphanumeric(),
        check("Password", "Password is required").not().isEmpty(),
        check("Email", "Email does not appear to be valid").isEmail(),
    ],
    (req, res) => {
        // check the validation object for errors
        let errors = validationResult(req);

        if (!errors.isEmpty()) {
            return res.status(422).json({ errors: errors.array() });
        }

        let hashedPassword = Users.hashPassword(req.body.Password);
        Users.findOne({ Username: req.body.Username })
            .then((user) => {
                if (user) {
                    return res.status(400).send(req.body.Username + "Already user inside Database");
                } else {
                    Users.create({
                        Username: req.body.Username,
                        Password: hashedPassword,
                        Email: req.body.Email,
                        Birthday: req.body.Birthday,
                        FavoriteMovies: req.body.FavoriteMovies,
                    })
                        .then((user) => {
                            res.status(201).json(user);
                        })
                        .catch((error) => {
                            console.error("Mongoose query error:", error);
                            res.status(500).send("Error: " + error);
                        });
                }
            })
            .catch((error) => {
                console.error("Error inserting user:", error);
                res.status(500).json({ error: "Internal server error" });
            });
    }
);

// Update User
app.put("/Users/:Username", passport.authenticate("jwt", { session: false }), async (req, res) => {
    try {
        if (req.user.Username !== req.params.Username) {
            return res.status(400).send("Permission denied");
        }
        console.log(req.user.Username, req.params.Username, "dddd");

        const updatedUser = await Users.findOneAndUpdate(
            { Username: req.params.Username },
            {
                $set: {
                    Username: req.body.Username,
                    Password: req.body.Password,
                    Email: req.body.Email,
                    Birthday: req.body.Birthday,
                },
            },
            { new: true }
        );

        if (!updatedUser) {
            return res.status(404).json({ message: "User not found" });
        }

        res.json(updatedUser);
    } catch (error) {
        console.error("Error updating user:", error);
        res.status(500).send("Error: " + error.message);
    }
});
//

// add favorite movie to user
app.post(
    "/Users/addfavorite",
    passport.authenticate("jwt", { session: false }),
    async (req, res) => {
        const { userId, movieId } = req.body;

        Users.findByIdAndUpdate(userId, { $addToSet: { FavoriteMovies: movieId } }, { new: true })
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
    "/Users/:id/:movieTitle",
    passport.authenticate("jwt", { session: false }),
    async (req, res) => {
        const { id, movieTitle } = req.params;

        Users.updateOne({ _id: id }, { $pull: { FavoriteMovies: movieTitle } })
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
app.delete("/Users/:id", passport.authenticate("jwt", { session: false }), async (req, res) => {
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
});

// ////////////////////////////////////////////////////////////
//                            MOVIES
// //////////////////////////////////////////////////////
// get all movies
app.get("/Movies", passport.authenticate("jwt", { session: false }), async (req, res) => {
    await Movies.find()
        .then((movies) => {
            res.status(201).json(movies);
        })
        .catch((error) => {
            console.error("Mongoose query error:", error);
            res.status(500).send("Error: " + error);
        });
});

// return movie by title
app.get("/Movies/:Title", passport.authenticate("jwt", { session: false }), async (req, res) => {
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
});

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

// Error Handling Middleware
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).send("Internal Server Error");
});

const port = process.env.PORT || 8080;
app.listen(port, "0.0.0.0", () => {
    console.log("Listening on Port " + port);
});
