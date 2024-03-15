# History Movie API

## Project Description

The History Movie API is a RESTful API built with Node.js and Express that provides access to a database of historical movies. It allows users to register, authenticate, and retrieve movie data based on various criteria such as title, genre, and director. The API also supports features like adding and removing favorite movies for registered users.

## Installation

1. Install Node.js and npm if you haven't already.
2. Clone this repository.
3. Navigate to the project directory and run `npm install` to install the required dependencies.

## Usage

To run the application locally, use the following command:

```bash
npm run dev
```

## API Endpoints

The following endpoints are available:

-   /login: Authenticate a user and generate a JSON Web Token (JWT).
-   /register: Register a new user.
-   /Movies: Get a list of all movies (requires authentication).
-   /Movies/:Title: Get details of a specific movie by title (requires authentication).
-   /Movies/genres/:Genre: Get a list of movies by genre (requires authentication).
-   /Movies/Director/:Name: Get details of a director by name (requires authentication).
-   /user/addfavorite: Add a movie to the user's favorite list (requires authentication).
-   /user/:id/:movieId: Remove a movie from the user's favorite list (requires authentication).
-   /user/:id: Delete a user (requires authentication)

## Technologies Used

-   Node.js
-   Express
-   MongoDB (with Mongoose)
-   JSON Web Tokens (JWT) for authentication
-   Passport.js for authentication middleware
-   Express Validator for input validation

### Contact

For any inquiries or feedback, please contact [Daniel John](mailto:almirante.danieljohn@gmail.com).
