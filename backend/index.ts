import express from "express"
import dotenv from "dotenv"
import {cleate5eUdonariumPc} from "./src/cleate5eUdonariumPc"

import cors from 'cors';
const corsOptions = {
  origin: true,
  exposedHeaders:["Content-Disposition"]
};

// アプリケーションで動作するようにdotenvを設定する
dotenv.config();
const app = express();

const PORT = process.env.PORT;

app.get("/create-5e-udonarium-pc", cors(corsOptions), (request, response) => {
  cleate5eUdonariumPc(request, response);
})

app.get("/hello", (request, response) => { 
  response.status(200).send("Hello.");
}); 

app.listen(PORT, () => { 
  console.log("Server running at PORT: ", PORT); 
}).on("error", (error) => {
  // エラーの処理
  console.error(error)
  throw new Error(error.message);
})