const express = require("express");
const router = express.Router();
const User = require("../model/User");
const nodemailer = require("nodemailer");
const smtpTransport = require("nodemailer-smtp-transport");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");
const multer = require("multer");
const cloudinary = require("cloudinary");
const cloudinaryStorage = require("multer-storage-cloudinary");
cloudinary.config({
  cloud_name: process.env.CLOUD_NAME,
  api_key: process.env.CLOUD_API_KEY,
  api_secret:process.env.CLOUD_API_SECRET
});
const storage = cloudinaryStorage({
  cloudinary: cloudinary,
  folder: "Notify",
  allowedFormats: ["jpg", "png", "jpeg"],
  transformation: [{ width: 500, height: 500, crop: "limit" }]
});
const upload = multer({ storage: storage });
router.post("/register", async (req, res) => {
  const user = req.body;
  let ExistingUser = await User.findOne({ email: user.email });
  if (ExistingUser) return res.status(400).send("User already exists");
  let transporter = nodemailer.createTransport(
    smtpTransport({
      service: "SendGrid",
      auth: {
        user: process.env.sendgrid_id,
        pass: process.env.sendgrid_pw
      }
    })
  );
  const token = jwt.sign(user, process.env.TOKEN_SECRET, { expiresIn: "3m" });
  let link = `<a href="http://localhost:5000/account/register/${token}">Confirm</a>`;
  let info = await transporter.sendMail({
    from: "noreplyhewy@gmail.com", // sender address
    to: user.email, // list of receivers
    subject: "Email Confirmation", // Subject line
    html: `<p>Please click on the link below to confirm your email address</p> <br> ${link}` // html body
  });
  info.messageId ? res.sendStatus(200) : res.sendStatus(400);
});
//confirmation email route.
router.get("/register/:token", async (req, res) => {
  const token = req.params.token;
  try {
    let picture;
    const validate = jwt.verify(token, process.env.TOKEN_SECRET);
    const ExistingUser = await User.findOne({ email: validate.email });
    if (ExistingUser) return res.send(`<h4>User already registered</h4>`);
    picture =
      validate.gender == "Male"
        ? "user_images/male.png"
        : "user_images/female.png";
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(validate.password, salt);
    let newUser = new User({
      firstname: validate.fname,
      lastname: validate.lname,
      email: validate.email,
      password: hashedPassword,
      role: "user",
      picture: picture,
      country: validate.country,
      gender: validate.gender
    });
    await newUser.save();
    res.redirect(`http://localhost:8080/`);
  } catch (err) {
    res.send(`<h4>This link has expired</h4>`);
  }
});
router.post("/login", async (req, res) => {
  const user = req.body;
  const ExistingUser = await User.findOne({ email: user.email });
  if (!ExistingUser) return res.status(401).send(`This email doesn't exist`);
  const comparePasswords = await bcrypt.compare(
    user.password,
    ExistingUser.password
  );
  if (!comparePasswords) return res.status(401).send(`Incorrect Password`);
  const token = jwt.sign({ id: ExistingUser._id }, process.env.TOKEN_SECRET, {
    expiresIn: "1h"
  });
  res
    .status(200)
    .cookie("Authorization", token, { httpOnly: true })
    .send(ExistingUser);
});
router.post("/picture", upload.single("profile_picture"), async (req, res) => {
  const email = req.body.email;
  const filePath = req.file.url;
  const user = await User.findOne({ email: email });
  if (
    user.picture != "user_images/male.png" &&
    user.picture != "user_images/female.png"
  ) {
    await cloudinary.uploader.destroy(user.pictureKey);
  }
  user.picture = filePath;
  user.pictureKey = req.file.public_id;
  await user.save();
  res.status(200).send(filePath);
});
router.put("/change-pw", async (req, res) => {
  const email = req.query.email;
  const existinguser = await User.findOne({ email: email });
  if (!existinguser) return res.status(404).send("Email not found");
  let transporter = nodemailer.createTransport(
    smtpTransport({
      service: "Gmail",
      auth: {
        user: process.env.gmail_id,
        pass: process.env.gmail_pw
      }
    })
  );
  const token = jwt.sign({ email: email }, process.env.TOKEN_SECRET, {
    expiresIn: "3m"
  });
  let link = `<a href="http://localhost:5000/account/change-pw/${token}">Change Password</a>`;
  let info = await transporter.sendMail({
    from: "noreply@domain.com", // sender address
    to: email, // list of receivers
    subject: "Password Reset", // Subject line
    html: `<p>Please click on the link below to reset your password</p> <br> ${link}` // html body
  });
  info.messageId ? res.sendStatus(200) : res.sendStatus(400);
});
router.get("/change-pw/:token", async (req, res) => {
  const token = req.params.token;
  try {
    const validate = jwt.verify(token, process.env.TOKEN_SECRET);
  } catch (err) {
    res.status(400).send("<h4>This link has expired</h4>");
  }
});
module.exports = router;