const http = require("http");
const express = require("express");
const { IamAuthenticator } = require("ibm-cloud-sdk-core");
const fs = require("fs");
const swaggerUi = require("swagger-ui-express");
const swaggerJsdoc = require("swagger-jsdoc");
const bodyParser = require("body-parser");
const request = require("request-promise");
const mysql = require("mysql2");
const dotenv = require("dotenv");
const { ChartJSNodeCanvas } = require("chartjs-node-canvas");
const sqlFormatter = require("sql-formatter");
dotenv.config();

const pool = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASS,
  database: process.env.DB_NAME,
  port: process.env.DB_PORT,
  rowsAsArray: true,
});

const authenticator = new IamAuthenticator({
  apikey: process.env.WATSONX_API_KEY,
});

const app = express();
app.use(express.static(__dirname + "/public"));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));
app.set("view engine", "ejs");

let prompt;
try {
  prompt = fs.readFileSync("prompt.txt", "utf8");
  console.log("prompt file loaded.");
} catch (err) {
  console.error("Error: ", err);
}

const server = http.Server(app);
const port = 8080;
server.listen(port, function () {
  console.log("\nServer running on", port);
});

const options = {
  definition: {
    openapi: "3.0.0", // OpenAPI version
    info: {
      title: "Healthcare Backend APIs", // Title of your API
      version: "1.0.0", // Version of your API
      description: "API documentation for your Express.js app",
    },
    servers: [
      {
        url: "",
      },
    ],
  },
  apis: ["healthcare-backend-server.js"], // Path to your route files or JSDoc comments
};

const swaggerSpec = swaggerJsdoc(options);
app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerSpec));
app.get("/read", (req, res) => res.json(swaggerSpec));

const unitOfMetric = [
  { name: "Hemoglobin", unit: "g/dL" },
  { name: "Hematocrit", unit: "percentage(%)" },
  { name: "RBC", unit: "M/mcL" },
  { name: "WBC", unit: "K/mcL" },
  { name: "Platelets", unit: "K/mcL" },
  { name: "Neutrophil", unit: "percentage(%)" },
  { name: "Lymphocyte", unit: "percentage(%)" },
  { name: "Monocyte", unit: "percentage(%)" },
  { name: "Eosinophil", unit: "percentage(%)" },
  { name: "Basophil", unit: "percentage(%)" },
  { name: "Mean Cell Volume", unit: "fL" },
  { name: "Mean Cell Hemoglobin", unit: "pg" },
  { name: "Mean Cell Hb Conc", unit: "g/dL" },
  { name: "Red Cell Dist Width", unit: "percentage(%)" },
  { name: "Mean Platelet Volume", unit: "fL" },
  { name: "TSH", unit: "mIU/L" },
  { name: "RBS", unit: "mg/dL" },
];

async function executeSQLQuery(query) {
  console.log("Generated SQL : ", query);
  const stopwords = [
    "create",
    "drop",
    "alter",
    "truncate",
    "comment",
    "rename",
    "insert",
    "update",
    "delete",
    "lock",
    "call",
    "explain plan",
    "grant",
    "revoke",
    "commit",
    "rollback",
    "savepoint",
  ];
  const stopWordFound = stopwords.some((sw) =>
    query.toLowerCase().includes(sw)
  );
  if (stopWordFound) {
    throw new Error("Query not allowed");
  }

  // get a Promise wrapped instance of that pool
  const promisePool = pool.promise();

  // Replace now() with latest date in table
  query = query
    .replaceAll("now()", "(select max(report_date) from patient_history)")
    .replaceAll("report_data", "report_date");
  return promisePool.query(query);
}

async function generateChart(labels, values, sqlquery, chartType) {
  const metric = unitOfMetric.filter((metricObj) =>
    sqlquery.toLowerCase().includes(metricObj.name.toLowerCase())
  );

  console.log("Retrived : ", metric);
  // setting properties for chart
  const width = 450;
  const height = 300;
  const months = {
    Jan: "01",
    Feb: "02",
    Mar: "03",
    Apr: "04",
    May: "05",
    Jun: "06",
    Jul: "07",
    Aug: "08",
    Sep: "09",
    Oct: "10",
    Nov: "11",
    Dec: "12",
  };
  console.log("Labels : ", labels);
  labels =
    chartType === "line"
      ? labels.map((label) => {
          let splittedLabel = label.split(" ");
          let date = splittedLabel[1];
          let month = months[splittedLabel[0]];
          let year = splittedLabel[2];
          return `${date}/${month}/${year}`;
        })
      : labels;

  const chartJSNodeCanvas = new ChartJSNodeCanvas({
    width,
    height,
  });
  const cfg = {
    type: chartType,
    data: {
      datasets: [
        {
          data: values,
          borderColor: chartType === "line" ? "#1192e8" : undefined,
          backgroundColor: chartType === "bar" ? "#1192e8" : undefined,
        },
      ],
      labels: labels,
    },
    options: {
      plugins: {
        legend: {
          display: false,
        },
      },
      scales: {
        x: {
          grid: {
            display: false,
          },
        },
        y: {
          grid: {
            display: false,
          },
          ticks: {
            count: 5,
          },
          title: {
            display: chartType === "line",
            text:
              metric && metric.length > 0
                ? `${metric[0].name} (${metric[0].unit})`
                : "",
          },
        },
      },
      layout: {
        padding: {
          top: 30,
          bottom: 30,
          left: 20,
          right: 20,
        },
      },
      devicePixelRatio: 4,
    },
  };
  return await chartJSNodeCanvas.renderToDataURL(cfg);
}

function formatDate(dateTime) {
  let splittedLables = String(dateTime).split(" ");
  let date = `${splittedLables[1]} ${splittedLables[2]} ${splittedLables[3]}`;
  return date;
}

function generateTable(rows, fields) {
  let table = "<table><tr>";
  fields.map((field) => {
    table += `<td style='border: 1px solid black; padding: 5px'><strong>${field.name}</strong></td>`;
  });
  table += "</tr>";
  rows.map((row) => {
    table += "<tr>";
    row.map((item) => {
      if (typeof item === "object")
        table += `<td style='border: 1px solid black; padding: 5px'>${formatDate(
          item
        )}</td>`;
      else
        table += `<td style='border: 1px solid black; padding: 5px'>${item}</td>`;
    });
    table += "</tr>";
  });
  table += "</table>";
  return table;
}
/**
 * @openapi
 * /suggest:
 *  post:
 *    summary: Get suggestions on anomalies
 *    description: This api will take input anomalised metrics and ask to LLM for suggestions.
 *    requestBody:
 *      required: true
 *      content:
 *        application/json:
 *          schema:
 *            type: object
 *            properties:
 *              Alerts:
 *                type: array
 *                description: An array of alerts.
 *                example:
 *                  - Hemoglobin
 *                  - RBS
 *            required:
 *              - Alerts
 *    responses:
 *      200:
 *        description: Successful response
 *        content:
 *          text/plain:
 *            schema:
 *              type: string
 *              example: The answer to your question is...
 *      400:
 *        description: Bad request. Invalid input data.
 *        content:
 *          application/json:
 *            schema:
 *              type: object
 *              properties:
 *                error:
 *                  type: string
 *                  example: Invalid request format
 *      500:
 *        description: Internal server error.
 *        content:
 *          application/json:
 *            schema:
 *              type: object
 *              properties:
 *                error:
 *                  type: string
 *                  example: An unexpected error occurred
 */
app.post("/suggest", async (req, res) => {
  console.log("\n/suggest..\n");
  let body = req.body;

  let payload = {
    project_id: process.env.WATSONX_PROJECT_ID,
    model_id: process.env.LLM_MODEL_ID,
    parameters: {
      decoding_method: "greedy",
      min_new_tokens: 1,
      max_new_tokens: 300,
      stop_sequences: [],
      repetition_penalty: 1,
    },
    input:
      "Answer in 150 words only.\nwhat could abnormal value of {parameter} mean? What are the recommendations to get it normal?",
  };

  const apiToken = await authenticator.tokenManager.getToken();
  let results = [];
  body.Alerts.forEach((alrt) => {
    let payloadCopy = JSON.parse(JSON.stringify(payload));
    payloadCopy.input = payloadCopy.input.replace("{parameter}", alrt);
    let options = {
      headers: {
        Authorization: "Bearer " + apiToken,
        "Content-Type": "application/json",
      },
      body: payloadCopy,
      json: true,
    };

    console.log("Called for :", alrt);
    let rr = request.post(process.env.WATSONX_ENDPOINT, options);
    results.push(rr);
  });
  await Promise.all(results).then(
    (values) => {
      console.log("Output received");
      let vs = values.map((v) =>
        v.results[0].generated_text.replace("\nAnswer:", "")
      );
      res.json(vs.join("\n"));
    },
    (err) => res.status(500).json({ error: err })
  );
  console.log("Exited suggest");
});

/**
 * @openapi
 * /gensql:
 *  post:
 *    summary: Generate SQL from NL
 *    description: This api will take input user query and ask to LLM for SQL.
 *    requestBody:
 *      required: true
 *      content:
 *        application/json:
 *          schema:
 *            type: object
 *            properties:
 *              question:
 *                type: string
 *                description: User's question on the report.
 *                example: What is my result...
 *            required:
 *              - question
 *    responses:
 *      200:
 *        description: Successful response
 *        content:
 *          text/plain:
 *            schema:
 *              type: string
 *              example: The answer to your question is...
 *      400:
 *        description: Bad request. Invalid input data.
 *        content:
 *          application/json:
 *            schema:
 *              type: object
 *              properties:
 *                error:
 *                  type: string
 *                  example: Invalid request format
 *      500:
 *        description: Internal server error.
 *        content:
 *          application/json:
 *            schema:
 *              type: object
 *              properties:
 *                error:
 *                  type: string
 *                  example: An unexpected error occurred
 */
app.post("/gensql", async (req, res) => {
  try {
    console.log("\n/gensql..\n");
    let body = req.body;

    let payload = {
      project_id: process.env.WATSONX_PROJECT_ID,
      model_id: process.env.LLM_MODEL_ID_SQL,
      parameters: {
        decoding_method: "greedy",
        min_new_tokens: 1,
        max_new_tokens: 100,
        stop_sequences: [";"],
        repetition_penalty: 1,
      },
      input: prompt + body.question + "\n\nOutput:\n",
    };

    const apiToken = await authenticator.tokenManager.getToken();
    let options = {
      headers: {
        Authorization: "Bearer " + apiToken,
        "Content-Type": "application/json",
      },
      body: payload,
      json: true,
    };

    console.log("Question :", body.question);
    await request.post(process.env.WATSONX_ENDPOINT, options).then(
      async (d) => {
        if (d.results[0].generated_text) {
          const sqlquery = d.results[0].generated_text;

          let [rows, fields] = await executeSQLQuery(sqlquery);
          console.log("Retrived fields : ", fields);
          console.log("Retrived rows from databse : ", rows);
          //round up values
          rows = rows.map((row) =>
            row.map((item) => {
              if (typeof item === "number") return Number(item.toFixed(2));
              else return item;
            })
          );
          let type = "";
          let data = "";
          // checking if 2nd column is numeric value -- O/p: Line Chart or Bar Chart
          if (
            rows.length > 0 &&
            rows[0].length === 2 &&
            typeof rows[0][1] === "number"
          ) {
            const labels = [];
            const values = [];
            const isObjectType = typeof rows[0][0] === "object";
            rows.map((item) => {
              labels.push(isObjectType ? formatDate(item[0]) : item[0]);
              values.push(item[1]);
            });
            const chartType = isObjectType ? "line" : "bar";
            console.log(`Sending ${chartType} chart image`);
            const chartString = await generateChart(
              labels,
              values,
              sqlquery,
              chartType
            );
            const imgTag = `<img class="WACImage__Image WACImage__Image--loaded" src="${chartString}" alt="" style="display: block;"/>`;

            type = "img";
            data = imgTag;
          }

          // checking if signle value returned -- O/p: Signle Text
          else if (rows.length === 1 && rows[0].length === 1) {
            const metric = unitOfMetric.filter((metricObj) =>
              sqlquery.toLowerCase().includes(metricObj.name.toLowerCase())
            );
            type = "text";
            data = `${String(rows[0][0])} ${
              metric && metric.length > 0 ? metric[0].unit : ""
            }`;
          }

          // O/p: Table
          else if (rows.length > 0) {
            const table = generateTable(rows, fields);
            type = "table";
            data = table;
          }
          res.json({
            type: type !== "" ? type : "text",
            data: data !== "" ? data : "No results found",
            sql: sqlFormatter.format(sqlquery, {
              language: "mysql",
              tabWidth: 4,
            }),
          });
          return;
        }
        res.json("Some error by LLM.");
      },
      (err) => res.status(500).json({ error: err })
    );
  } catch (err) {
    console.log(err);
    let flg = 0;
    if (err.message === "Query not allowed") flg = 1;
    res.send({
      type: "text",
      data:
        flg === 1
          ? "You are not allowed to perform this action"
          : "Unable to get answer from your health data, please retry with another query.",
      sql: "Generated SQL will be displayed here",
    });
  }
});

// Homepage
app.get("/", function (req, res) {
  res.render("pages/homepage", {
    wa_integration_id: process.env.WAINTEGRATIONID,
    wa_region: process.env.WAREGION,
    wa_service_instance_id: process.env.WASERVICEINSTANCEID,
  });
});
