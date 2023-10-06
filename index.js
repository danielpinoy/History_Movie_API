const express = require("express"),
    morgan = require("morgan");

const app = express();

let historicBooks = [
    {
        title: " Babylon",
        Director: "J.K. Rowling",
    },
    {
        title: "Dunkirk ",
        author: "Christopher Nolan",
    },
    {
        title: "The Death of Stalin",
        author: "Armando Iannucci",
    },
    {
        title: "Waterloo",
        author: "Sergey Bondarchuk",
    },
    {
        title: "Citizen Kane",
        author: "Orson Welles",
    },
    {
        title: "All Quiet on the Western Front",
        author: "Edward Berger",
    },
    {
        title: "Saving Private Ryan",
        author: "Steven Spielberg",
    },
    {
        title: "Zulu ",
        author: "Cy Endfield",
    },
    {
        title: "Gladiator ",
        author: "Ridley Scott",
    },
    {
        title: "The King's Speech",
        author: "Tom Hooper",
    },
];

// Everything in the public folder will be served
app.use(express.static("public"));

// logs in http request into terminal
app.use(morgan("common"));

// GET requests
app.get("/", (req, res, next) => {
    res.send("Welcome to my library of Historic Movies");
});

// error function
app.use((err, req, res) => {
    // Handle the error and send an error response
    console.error(err.stack);
    res.status(500).send("Internal Server Error");
});

app.get("/historic-movies", (req, res, next) => {
    res.json(historicBooks);
});

app.listen(8080, () => {
    console.log("Your app is listening on port 8080.");
});
