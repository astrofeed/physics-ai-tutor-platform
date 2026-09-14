-- CreateTable
CREATE TABLE "PresentationRoster" (
    "id" TEXT NOT NULL,
    "sourceUrl" TEXT NOT NULL,
    "importedById" TEXT NOT NULL,
    "importedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PresentationRoster_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PresentationRosterEntry" (
    "id" TEXT NOT NULL,
    "rosterId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "name" TEXT,
    "englishName" TEXT,
    "topic" TEXT,
    "groupLabel" TEXT,
    "presentationDate" TEXT,

    CONSTRAINT "PresentationRosterEntry_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PresentationRosterEntry_studentId_idx" ON "PresentationRosterEntry"("studentId");

-- CreateIndex
CREATE UNIQUE INDEX "PresentationRosterEntry_rosterId_studentId_key" ON "PresentationRosterEntry"("rosterId", "studentId");

-- AddForeignKey
ALTER TABLE "PresentationRoster" ADD CONSTRAINT "PresentationRoster_importedById_fkey" FOREIGN KEY ("importedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PresentationRosterEntry" ADD CONSTRAINT "PresentationRosterEntry_rosterId_fkey" FOREIGN KEY ("rosterId") REFERENCES "PresentationRoster"("id") ON DELETE CASCADE ON UPDATE CASCADE;
