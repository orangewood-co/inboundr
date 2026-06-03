import "dotenv/config";
import mongoose from "mongoose";
import { connectDB, disconnectDB } from "../config/database.config";
import { Employee } from "../models/employee.model";
import { EmployeeDocument } from "../models/employee-document.model";
import {
  EMPLOYEE_DOCUMENT_TYPES,
  createEmployeeDocumentSnapshot,
  employeeDocumentSnapshotEquals,
  employeeDocumentTitle,
  upsertEmployeeDocument,
} from "../services/employee-document.service";

mongoose.set("autoIndex", false);

const SYSTEM_USER_ID = "system";

async function main(): Promise<void> {
  await connectDB();

  const counts = {
    employeesScanned: 0,
    documentsCreated: 0,
    documentsUpdated: 0,
    duplicatesDeleted: 0,
  };

  try {
    const employees = await Employee.find({ status: { $ne: "archived" } })
      .populate("teamId", "name")
      .lean();
    counts.employeesScanned = employees.length;

    for (const employee of employees) {
      for (const type of EMPLOYEE_DOCUMENT_TYPES) {
        const documents = await EmployeeDocument.find({
          organizationId: employee.organizationId,
          employeeId: employee._id,
          type,
        }).sort({ createdAt: -1 });

        const [latest, ...olderDocuments] = documents;
        if (olderDocuments.length > 0) {
          const result = await EmployeeDocument.deleteMany({
            _id: { $in: olderDocuments.map((document) => document._id) },
          });
          counts.duplicatesDeleted += result.deletedCount ?? 0;
        }

        const nextSnapshot = createEmployeeDocumentSnapshot(employee);
        const shouldCreate = !latest;
        const shouldUpdate = Boolean(
          latest &&
            (latest.title !== employeeDocumentTitle(type) ||
              !employeeDocumentSnapshotEquals(latest.employeeSnapshot, nextSnapshot))
        );

        await upsertEmployeeDocument({
          organizationId: employee.organizationId,
          employee,
          type,
          generatedByUserId: SYSTEM_USER_ID,
        });

        if (shouldCreate) counts.documentsCreated += 1;
        if (shouldUpdate) counts.documentsUpdated += 1;
      }
    }

    console.log("Employee document backfill complete", counts);
  } finally {
    await disconnectDB();
  }
}

main().catch((err) => {
  console.error("Employee document backfill failed:", err);
  process.exit(1);
});
