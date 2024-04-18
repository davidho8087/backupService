/*
  Warnings:

  - You are about to drop the column `UUID` on the `Detection` table. All the data in the column will be lost.
  - Added the required column `detection_id` to the `Detection` table without a default value. This is not possible if the table is not empty.

*/
-- RedefineTables
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Detection" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "detection_id" TEXT NOT NULL,
    "tracker_id" TEXT NOT NULL,
    "store_code" TEXT NOT NULL,
    "event_type" TEXT NOT NULL,
    "event_name" TEXT NOT NULL,
    "duration" REAL NOT NULL DEFAULT 0,
    "count" INTEGER NOT NULL DEFAULT 0,
    "class_type" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "date_time" DATETIME NOT NULL,
    "camera_name" TEXT NOT NULL,
    "region" TEXT NOT NULL,
    "region_id" TEXT NOT NULL,
    "zone_name" TEXT NOT NULL
);
INSERT INTO "new_Detection" ("camera_name", "class_type", "count", "date_time", "duration", "event_name", "event_type", "id", "message", "region", "region_id", "store_code", "tracker_id", "zone_name") SELECT "camera_name", "class_type", "count", "date_time", "duration", "event_name", "event_type", "id", "message", "region", "region_id", "store_code", "tracker_id", "zone_name" FROM "Detection";
DROP TABLE "Detection";
ALTER TABLE "new_Detection" RENAME TO "Detection";
PRAGMA foreign_key_check;
PRAGMA foreign_keys=ON;
