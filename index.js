const express = require("express"),
    morgan = require("morgan"),
    bodyParser = require("body-parser"),
    { v4: uuidv4 } = require("uuid");

const app = express();

app.use(bodyParser.json());

historicBooks = [
    {
        id: 1,
        title: "Babylon",
        director: {
            name: "Damien Chazelle",
            bio: "Damien Chazelle is an American director known for his exceptional work in drama and musical genres. Born in 1985, he has received critical acclaim for his contributions to the film industry.",
            birthYear: 1985,
        },
        criticRating: 9.0,
        userRating: 8.5,
        genres: ["Drama", "Musical"],
    },
    {
        id: 2,
        title: "Dunkirk",
        director: {
            name: "Christopher Nolan",
            bio: "Christopher Nolan is a British-American filmmaker known for his remarkable achievements in war and action genres. Born in 1970, he has left a significant impact on cinema.",
            birthYear: 1970,
        },
        criticRating: 8.5,
        userRating: 8.0,
        genres: ["War", "Action"],
    },
    {
        id: 3,
        title: "The Death of Stalin",
        director: {
            name: "Armando Iannucci",
            bio: "Armando Iannucci is a Scottish satirist and director who has made notable contributions to the world of comedy and drama. Born in 1963, his work is celebrated for its unique wit and humor.",
            birthYear: 1963,
        },
        criticRating: 7.8,
        userRating: 7.2,
        genres: ["Comedy", "Drama"],
    },
    {
        id: 4,
        title: "Waterloo",
        director: {
            name: "Sergey Bondarchuk",
            bio: "Sergey Bondarchuk was a Soviet actor and filmmaker who made significant contributions to war and drama genres. Born in 1920, he is remembered for his impactful work in cinema.",
            birthYear: 1920,
        },
        criticRating: 8.2,
        userRating: 8.1,
        genres: ["War", "Drama"],
    },
    {
        id: 5,
        title: "Citizen Kane",
        director: {
            name: "Orson Welles",
            bio: "Orson Welles was an American actor and director renowned for his work in drama and mystery genres. Born in 1915, he left a lasting legacy in the world of cinema.",
            birthYear: 1915,
        },
        criticRating: 9.5,
        userRating: 9.0,
        genres: ["Drama", "Mystery"],
    },
    {
        id: 6,
        title: "All Quiet on the Western Front",
        director: {
            name: "Edward Berger",
            bio: "Edward Berger is a German director known for his contributions to war and drama genres. Born in 1970, his work has been critically acclaimed.",
            birthYear: 1970,
        },
        criticRating: 8.7,
        userRating: 8.3,
        genres: ["War", "Drama"],
    },
    {
        id: 7,
        title: "Saving Private Ryan",
        director: {
            name: "Steven Spielberg",
            bio: "Steven Spielberg is an American filmmaker known for his exceptional work in war and action genres. Born in 1946, he has had a profound impact on the film industry.",
            birthYear: 1946,
        },
        criticRating: 8.9,
        userRating: 8.7,
        genres: ["War", "Action"],
    },
    {
        id: 8,
        title: "Zulu",
        director: {
            name: "Cy Endfield",
            bio: "Cy Endfield was an American filmmaker known for his contributions to war and action genres. Born in 1914, his work has been celebrated for its cinematic excellence.",
            birthYear: 1914,
        },
        criticRating: 8.0,
        userRating: 7.5,
        genres: ["War", "Action"],
    },
    {
        id: 9,
        title: "Gladiator",
        director: {
            name: "Ridley Scott",
            bio: "Ridley Scott is an English filmmaker recognized for his work in action and drama genres. Born in 1937, he has created some of cinema's iconic works.",
            birthYear: 1937,
        },
        criticRating: 8.6,
        userRating: 8.2,
        genres: ["Action", "Drama"],
    },
    {
        id: 10,
        title: "The King's Speech",
        director: {
            name: "Tom Hooper",
            bio: "Tom Hooper is an English film and television director known for his work in drama and biography films. Born in 1972, he has made significant contributions to storytelling in cinema.",
            birthYear: 1972,
        },
        criticRating: 8.4,
        userRating: 8.0,
        genres: ["Drama", "Biography"],
    },
];

users = [{ id: 1, username: "Daniel", password: "123", favoriteMovies: [] }];

// Everything in the public folder will be served
app.use(express.static("public"));

// logs in http request into terminal
app.use(morgan("common"));

// GET requests
app.get("/", (req, res, next) => {
    res.send("Welcome to my library of Historic Movies");
});

app.get("/documentation", (req, res) => {
    const filePath = "public/documentation.html";
    res.sendFile(filePath, { root: __dirname });
});
// Add new user
app.post("/register", (req, res) => {
    const { username, password } = req.body;

    // If username already taken
    if (users.find((user) => user.username === username)) {
        return res.status(400).json({ error: "Username already exists" });
    }
    const userId = uuidv4();

    const newUser = { id: userId, username, password };

    users.push(newUser);

    res.status(201).json({ message: "User registered successfully" });
});

// get
app.get("/users", (req, res) => {
    res.json(users);
});

// Update User
app.put("/users/:id", (req, res) => {
    const { id } = req.params;
    const { newUsername } = req.body;

    const userToUpdate = users.find((user) => user.id == id);

    if (userToUpdate) {
        userToUpdate.username = newUsername;
        res.status(200).send("Username updated successfully");
    } else {
        return res.status(404).send("User not found");
    }
});
//

// add favorite movie to user
app.post("/users/:id/:movieTitle", (req, res) => {
    const { id, movieTitle } = req.params;

    const user = users.find((user) => user.id == id);

    if (user) {
        user.favoriteMovies.push(movieTitle);
        res.status(201).send(`${movieTitle} have been added to user ${id}`);
    } else {
        res.status(400).send("User not found");
    }
});

// Delete
app.delete("/users/:id/:movieTitle", (req, res) => {
    const { id, movieTitle } = req.params;

    let user = users.find((user) => user.id !== id);

    if (user) {
        user.favoriteMovies = user.favoriteMovies.filter((title) => title !== movieTitle);
        res.status(201).send(`${movieTitle} have been removed to user ${id}`);
    } else {
        res.status(400).send("User not found");
    }
});

// Delete

app.delete("/users/:id/", (req, res) => {
    const { id } = req.params;

    let user = users.find((user) => user.id == id);

    if (user) {
        users = users.filter((user) => user.id != id);
        res.status(201).send(`user ${id} have been removed`);
        // res.json(users);
    } else {
        res.status(400).send("User not found");
    }
});

// get all movies
app.get("/historic-movies", (req, res, next) => {
    res.json(historicBooks);
});

// return movie by title
app.get("/historic-movies/:title", (req, res) => {
    const { title } = req.params;

    const movies = historicBooks.find((movie) => movie.title === title);
    console.log(movies);
    if (!movies) {
        res.status(404).send("Movie not found ");
    }

    res.json(movies);
});

// return movie by genre
app.get("/historic-movies/genres/:genre", (req, res) => {
    const { genre } = req.params;

    const movies = historicBooks.filter((movie) => movie.genres.includes(genre));

    if (movies) {
        res.json(movies);
    } else {
        res.status(404).send("No movies with this genre");
    }
});

// return director by name
app.get("/historic-movies/director/:name", (req, res) => {
    const { name } = req.params;

    const movies = historicBooks.find((movie) => movie.director.name === name);
    if (movies) {
        res.json(movies.director);
    } else {
        res.status(404).send("Director not found");
    }
});
// error function
app.use((err, req, res, next) => {
    // Handle the error and send an error response
    console.error(err.stack);
    res.status(500).send("Internal Server Error");
});

app.listen(8080, () => {
    console.log("Your app is listening on port 8080.");
});
