require("dotenv").config();
const express = require("express");
const cors = require("cors");
const app = express();
const port = process.env.PORT || 3000;
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");

// Middleware
app.use(cors());
app.use(express.json());

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
    await client.connect();

    // Job related API's
    const database = client.db("jobPortalDB");
    const jobsCollection = database.collection("jobs");
    const jobApplicationCollections = database.collection("jobApplications");

    // GET API endpoint for accessing jobs
    app.get("/jobs", async (req, res) => {
      const email = req.query.email;

      let query = {};
      if (email) {
        query = { hr_email: email };
      }

      const cursor = jobsCollection.find(query);
      const result = await cursor.toArray();
      res.send(result);
    });

    // GET API Endpoint for specific jobs related data
    app.get("/jobs/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      // const query = { _id: id };
      const result = await jobsCollection.findOne(query);
      res.send(result);
    });

    // POST API for creating new job
    app.post("/jobs", async (req, res) => {
      const newJob = req.body;
      const result = await jobsCollection.insertOne(newJob);
      res.send(result);
    });

    // POST API Endpoint for job application submissions
    app.post("/job-applications", async (req, res) => {
      const application = req.body;
      const result = await jobApplicationCollections.insertOne(application);

      // Poor way to aggregate data
      const id = application.job_id;
      const query = { _id: new ObjectId(id) };
      const job = await jobsCollection.findOne(query);

      let count = 1;
      if (job.totalApplicant) {
        count = job.totalApplicant + 1;
      }
      // Update the job applicant number
      const updateJob = {
        $set: {
          totalApplicant: count,
        },
      };
      const newUpdatedJob = await jobsCollection.updateOne(query, updateJob);
      console.log(newUpdatedJob);

      // Return the result as response
      res.send(result);
    });

    // query
    // ?name=value&name=value&name=value
    // Get data (one, some, many);

    app.get("/job-application", async (req, res) => {
      const email = req.query.email;
      const query = { applicant_email: email };
      const result = await jobApplicationCollections.find(query).toArray();

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
      const result = await jobApplicationCollections.find(query).toArray();
      res.send(result);
    });

    // API for updating the job status using patch
    app.patch("/job-applications/:applicant_id", async (req, res) => {
      const applicantId = req.params.applicant_id;
      const filter = { _id: new ObjectId(applicantId) };
      const updatedStatus = req.body;

      const updateDoc = {
        $set: {
          status: updatedStatus.status,
        },
      };

      const result = await jobApplicationCollections.updateOne(filter, updateDoc);
      res.send(result);
    });

    // Send a ping to confirm a successful connection
    await client.db("admin").command({ ping: 1 });
    console.log("Pinged your deployment. You successfully connected to MongoDB!");
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
