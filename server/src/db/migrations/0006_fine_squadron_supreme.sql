CREATE UNIQUE INDEX "entities_project_type_slug_unique" ON "entities" USING btree ("project_id","type","slug");
