// One-off dev helper: fills sample careers story/team/benefits content for a
// given organizationPath so the redesigned public careers page can be reviewed.
// Usage: bun src/scripts/seed-careers-story.ts [organizationPath]
import mongoose from "mongoose";
import { RecruitmentSettings } from "../models/recruitment-settings.model";

const organizationPath = (process.argv[2] ?? "orangewood-labs").toLowerCase();
const uri = process.env.MONGODB_URI;
if (!uri) throw new Error("MONGODB_URI environment variable is not set");

await mongoose.connect(uri);

const settings = await RecruitmentSettings.findOneAndUpdate(
  { organizationPath },
  {
    $set: {
      contactEmail: "careers@orangewoodlabs.com",
      aboutTitle: "",
      aboutBody: [
        "We're building modern robotics tools for teams and builders who care deeply about clarity, performance, and scale. Orangewood exists to make working with robotic arms feel more intentional, structured, and approachable without compromising power or flexibility.",
        "At Orangewood, you'll work on core infrastructure that powers real products, not demos or short-lived experiments. The systems we build sit at the foundation of real workflows, internal tools, and production applications used every day.",
        "Every decision we make is grounded in long-term scalability and usability, ensuring our tools remain dependable as teams and products grow.",
        "Our team values ownership, clear thinking, and meaningful collaboration. We work in small, focused teams where everyone has real responsibility and the space to make thoughtful decisions.",
        "If you care about building solid robotics tools and want to work on infrastructure that truly matters, Orangewood is the place to do it.",
      ].join("\n\n"),
      teamMembers: [
        { name: "Alexandra Reed", role: "Head of Product" },
        { name: "Oliver Grant", role: "Principal Software Engineer" },
        { name: "Ryan O'Connor", role: "Senior Frontend Engineer" },
        { name: "Daniel Whitmore", role: "Chief Technology Officer" },
        { name: "Emily Parker", role: "Product Marketing Lead" },
        { name: "Aisha Rahman", role: "Security Operations Manager" },
        { name: "Sofia Martinez", role: "Head of Design" },
        { name: "Lucas Nguyen", role: "Head of Infrastructure" },
        { name: "Benjamin Lee", role: "Platform Architect" },
      ],
      benefits: [
        { title: "Meaningful Work", description: "Build infrastructure that powers real products." },
        { title: "High Ownership", description: "Take responsibility and make real decisions." },
        { title: "Focused Teams", description: "Work with a small team of dedicated builders." },
        { title: "Remote by Default", description: "Work from anywhere with flexible schedules." },
        { title: "Room to Grow", description: "Learn, improve, and grow with the product." },
        { title: "Competitive Pay", description: "Fair pay, reviewed as the company grows." },
      ],
    },
  },
  { returnDocument: "after" }
);

console.log(settings ? `Seeded careers story for ${organizationPath}` : `No settings found for ${organizationPath}`);
await mongoose.disconnect();
