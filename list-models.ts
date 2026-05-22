import { GoogleGenAI } from "@google/genai";
const ai = new GoogleGenAI();
async function run() {
  const response = await ai.models.list();
  for await (const model of response) {
    console.log(model.name);
  }
}
run();
