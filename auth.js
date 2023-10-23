const jwtSecret = "your_jwt_secret"; // this has to be the same key used in the JWTStrategy

const jwt = require("jsonwebtoken"),
    passport = require("passport");

require("./passport"); // Your local passport file

let generateJWTToken = (user) => {
    return jwt.sign(user, jwtSecret, {
        subject: user.Username, // This is the username you’re encoding in the JWT
        expiresIn: "7d", // This specifies that the token will expire in 7 days
        algorithm: "HS256", // This is the algorithm used to “sign” or encode the values of the JWT
    });
};

//  POST LOGIN
passport.use(
    new LocalStrategy(
        { usernameField: "Username", passwordField: "Password" },
        async (username, password, callback) => {
            console.log(`Username: ${username}`);
            console.log(`Password: ${password}`);
            await Users.findOne({ Username: username })
                .then((user) => {
                    console.log(`Hashed Password from Database: ${user.Password}`);
                    if (!user) {
                        console.log("Incorrect username");
                        return callback(null, false, {
                            message: "Incorrect username or password",
                        });
                    }
                    if (!user.validatePassword(password)) {
                        console.log("Incorrect password");
                        return callback(null, false, { message: "Incorrect password." });
                    }
                    console.log("Authentication successful");
                    return callback(null, user);
                })
                .catch((error) => {
                    if (error) {
                        console.log(error);
                        return callback(error);
                    }
                });
        }
    )
);
