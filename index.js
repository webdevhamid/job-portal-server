require("dotenv").config();
const express = require("express");
const cors = require("cors");
const app = express();
const port = process.env.PORT || 3000;
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const jwt = require("jsonwebtoken");
const cookieParser = require("cookie-parser");

// Middlewares
app.use(
  cors({
    origin: [
      "http://localhost:5173",
      "https://job-portal-b841a.web.app",
      "https://job-portal-b841a.firebaseapp.com",
    ],
    credentials: true,
  })
);
app.use(express.json());
app.use(cookieParser());

const verifyToken = (req, res, next) => {
  const token = req.cookies?.token;

  if (!token) {
    return res.status(401).send({ message: "Unauthorized access" });
  }

  // Verity the token
  jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
    // return err, if the token is invalid
    if (err) {
      return res.status(403).send({ message: "Unauthorized Access" });
    }
    // Store the token info to the user object
    req.user = decoded;

    next();
  });
};

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.w1xw1.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;
// const uri = `mongodb://localhost:27017`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    // await client.connect();

    // Job related API's
    const database = client.db("jobPortalDB");
    const jobsCollection = database.collection("jobs");
    const jobApplicationCollection = database.collection("jobApplications");

    // Auth related APIs
    app.post("/jwt", async (req, res) => {
      const userEmail = req.body;

      const token = jwt.sign(userEmail, process.env.ACCESS_TOKEN_SECRET, { expiresIn: "10h" });

      res
        .cookie("token", token, {
          httpOnly: true,
          secure: process.env.NODE_ENV === "production",
          sameSite: process.env.NODE_ENV === "production" ? "none" : "strict",
        })
        .send({ message: "Token successfully created!" });
    });

    // Clearing cookies after successful logout
    app.post("/logout", (req, res) => {
      res
        .clearCookie("token", {
          httpOnly: true,
          secure: process.env.NODE_ENV === "production",
          sameSite: process.env.NODE_ENV === "production" ? "none" : "strict",
        })
        .send({ message: "Logged out successfully!" });
    });

    // GET API endpoint for accessing jobs with or without email
    app.get("/jobs", async (req, res) => {
      // console.log("Inside the other API callback");

      const email = req.query.email;

      let query = {};
      if (email) {
        query = { hr_email: email };
      }

      const cursor = jobsCollection.find(query);
      const result = await cursor.toArray();
      res.send(result);
    });

    // POST API for creating new job
    app.post("/jobs", async (req, res) => {
      const newJob = req.body;
      const result = await jobsCollection.insertOne(newJob);
      res.send(result);
    });

    // GET API Endpoint for specific jobs related data
    app.get("/jobs/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await jobsCollection.findOne(query);
      res.send(result);
    });

    // POST API Endpoint for job application submissions
    app.post("/job-applications", async (req, res) => {
      const application = req.body;
      const result = await jobApplicationCollection.insertOne(application);

      // Poor way to aggregate data
      const id = application.job_id;
      const query = { _id: new ObjectId(id) };
      const job = await jobsCollection.findOne(query);

      let count = 1;
      if (job.totalApplicant) {
        count = job.totalApplicant + 1;
      }
      // Update the job applicant number
      const updateDoc = {
        $set: {
          totalApplicant: count,
        },
      };
      const newUpdatedJob = await jobsCollection.updateOne(query, updateDoc);
      // console.log(newUpdatedJob);

      // Return the result as response
      res.send(result);
    });

    // query
    // ?name=value&name=value&name=value
    // Get data (one, some, many);

    // API for getting my applied jobs using email address query
    app.get("/job-application", verifyToken, async (req, res) => {
      const email = req.query.email;
      const query = { applicant_email: email };

      // if (req.user.email !== email) {
      //   return res.status(403).send({ message: "Forbidden access" });
      // }

      if (req.user.userEmail !== email) {
        return res.status(403).send({ message: "forbidden access" });
      }

      const result = await jobApplicationCollection.find(query).toArray();

      // console.log(`Cookies`, req.cookies);
      // console.log(req.user);

      // Poor way to aggregate data
      for (const application of result) {
        const jobId = application.job_id;
        const query = { _id: new ObjectId(jobId) };
        const myApplication = await jobsCollection.findOne(query);

        application.title = myApplication.title;
        application.company = myApplication.company;
        application.company_logo = myApplication.company_logo;
        application.status = myApplication.status;
        application.location = myApplication.location;
      }

      res.send(result);
    });

    // API endpoint for job specific applications
    app.get("/job-applications/jobs/:job_id", async (req, res) => {
      const jobId = req.params.job_id;
      const query = { job_id: jobId };
      const result = await jobApplicationCollection.find(query).toArray();
      res.send(result);
    });

    // API for updating the job status using patch
    app.patch("/job-applications/:id", async (req, res) => {
      const jobId = req.params.id;
      const updatedStatus = req.body;
      const filter = { _id: new ObjectId(jobId) };

      const updateDoc = {
        $set: {
          status: updatedStatus.status,
        },
      };

      const result = await jobApplicationCollection.updateOne(filter, updateDoc);
      res.send(result);
    });

    // Send a ping to confirm a successful connection
    // await client.db("admin").command({ ping: 1 });
    // console.log("Pinged your deployment. You successfully connected to MongoDB!");
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);

app.get("/", (req, res) => {
  res.send("Hello from job portal server!");
});

app.listen(port, () => {
  console.log(`Job portal app listening on port ${port}`);
});
