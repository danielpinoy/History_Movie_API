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
module.exports = (router) => {
    router.post("/login", (req, res) => {
        console.log("Request body:", req.body);
        passport.authenticate("local", { session: false }, (error, user, info) => {
            if (error) {
                console.log("Authentication error:", error);
                return res.status(500).json({ message: "Internal server error" });
            }
            if (!user) {
                console.log("Authentication failed:", info);
                return res.status(401).json({ message: "Invalid username or password" });
            }
            req.login(user, { session: false }, (error) => {
                if (error) {
                    console.log("Login error:", error);
                    return res.status(500).json({ message: "Internal server error" });
                }
                let token = generateJWTToken(user.toJSON());
                return res.json({ user, token });
            });
        })(req, res);
    });
};
