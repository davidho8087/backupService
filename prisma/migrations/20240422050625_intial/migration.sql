-- CreateTable
CREATE TABLE "Detection" (
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
    "zone_name" TEXT NOT NULL,
    "file_name" TEXT
);
