// Temporary verification: flips section toggles off, checks the public API
// omits hidden content, then restores the toggles.
import mongoose from "mongoose";
import { RecruitmentSettings } from "../models/recruitment-settings.model";

const uri = process.env.MONGODB_URI;
if (!uri) throw new Error("MONGODB_URI environment variable is not set");
await mongoose.connect(uri);

const fetchPublic = async () => {
  const response = await fetch("http://localhost:3000/api/v1/public/recruitment/orangewood-labs");
  const { careers } = (await response.json()) as { careers: Record<string, any> };
  return {
    aboutBody: (careers.aboutBody as string).length,
    team: (careers.teamMembers as unknown[]).length,
    benefits: (careers.benefits as unknown[]).length,
  };
};

const set = (sections: Record<string, boolean>) =>
  RecruitmentSettings.updateOne({ organizationPath: "orangewood-labs" }, { $set: { sections } });

console.log("all enabled:", await fetchPublic());
await set({ story: false, benefits: false, team: false });
console.log("all disabled:", await fetchPublic());
await set({ story: true, benefits: true, team: true });
console.log("restored:", await fetchPublic());
await mongoose.disconnect();
