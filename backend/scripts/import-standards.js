const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

const STANDARDS_DIR = path.join(__dirname, '..', 'data', 'standards');

class StandardsImporter {
  constructor(db) {
    this.db = db;
    this.stats = {
      newRecords: 0,
      updatedRecords: 0,
      skippedRecords: 0,
      errors: [],
      metadataAssignments: 0
    };
  }

  async importAll() {
    console.log('='.repeat(60));
    console.log('Standards Library Importer');
    console.log('='.repeat(60));
    console.log(`Standards directory: ${STANDARDS_DIR}`);
    console.log('');

    const files = fs.readdirSync(STANDARDS_DIR)
      .filter(f => f.endsWith('.json') && !f.includes('template'));

    console.log(`Found ${files.length} standard files to import:`);
    files.forEach(f => console.log(`  - ${f}`));
    console.log('');

    for (const file of files) {
      await this.importStandardFile(path.join(STANDARDS_DIR, file));
    }

    this.printSummary();
    return this.stats;
  }

  async importStandardFile(filePath) {
    const fileName = path.basename(filePath);
    console.log(`\nImporting: ${fileName}`);
    console.log('-'.repeat(40));

    try {
      const content = fs.readFileSync(filePath, 'utf8');
      const standard = JSON.parse(content);

      console.log(`  Standard: ${standard.name}`);
      console.log(`  Family: ${standard.family}`);
      console.log(`  Version: ${standard.version}`);
      console.log(`  Requirements: ${standard.requirements.length}`);

      for (const req of standard.requirements) {
        await this.importRequirement(req, standard);
      }

      console.log(`  Completed: ${fileName}`);
    } catch (error) {
      console.error(`  ERROR: Failed to import ${fileName}: ${error.message}`);
      this.stats.errors.push({
        file: fileName,
        error: error.message
      });
    }
  }

  async importRequirement(req, standard) {
    try {
      const existingReq = await this.findExistingRequirement(req.code, standard.family, standard.version);

      if (existingReq) {
        const hasChanges = this.requirementHasChanges(existingReq, req, standard);
        if (hasChanges) {
          await this.updateRequirement(existingReq.id, req, standard);
          this.stats.updatedRecords++;
        } else {
          this.stats.skippedRecords++;
        }
      } else {
        const newId = await this.createRequirement(req, standard);
        this.stats.newRecords++;
        
        if (req.metadata_tags && req.metadata_tags.length > 0) {
          await this.assignMetadataTags(newId, req.metadata_tags);
        }
      }
    } catch (error) {
      console.error(`    ERROR importing ${req.code}: ${error.message}`);
      this.stats.errors.push({
        code: req.code,
        error: error.message
      });
    }
  }

  async findExistingRequirement(code, family, version) {
    const isPostgres = this.db.isPostgres && this.db.isPostgres();
    const placeholder = isPostgres ? '$1' : '?';
    const placeholder2 = isPostgres ? '$2' : '?';
    const placeholder3 = isPostgres ? '$3' : '?';
    
    const query = `
      SELECT * FROM compliance_requirements 
      WHERE code = ${placeholder} AND family = ${placeholder2} AND version = ${placeholder3}
    `;
    
    const rows = await this.db.all(query, [code, family, version]);
    return rows && rows.length > 0 ? rows[0] : null;
  }

  requirementHasChanges(existing, newReq, standard) {
    return existing.title !== newReq.title ||
           existing.description !== newReq.description ||
           existing.description_long !== newReq.description_long ||
           existing.hierarchy_level !== newReq.hierarchy_level ||
           existing.domain !== newReq.domain ||
           existing.category !== newReq.category ||
           existing.regulation !== newReq.regulation;
  }

  async createRequirement(req, standard) {
    const isPostgres = this.db.isPostgres && this.db.isPostgres();
    const id = uuidv4();
    
    let query, params;
    
    if (isPostgres) {
      query = `
        INSERT INTO compliance_requirements (
          id, title, description, regulation, category, status, 
          family, code, version, hierarchy_level, domain, description_long,
          created_at, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
        RETURNING id
      `;
    } else {
      query = `
        INSERT INTO compliance_requirements (
          id, title, description, regulation, category, status, 
          family, code, version, hierarchy_level, domain, description_long,
          created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
      `;
    }
    
    params = [
      id,
      req.title,
      req.description,
      req.regulation || standard.name,
      req.category || 'General',
      'pending',
      standard.family,
      req.code,
      standard.version,
      req.hierarchy_level || 'control',
      req.domain || null,
      req.description_long || null
    ];

    await this.db.run(query, params);
    return id;
  }

  async updateRequirement(id, req, standard) {
    const isPostgres = this.db.isPostgres && this.db.isPostgres();
    
    let query;
    if (isPostgres) {
      query = `
        UPDATE compliance_requirements SET
          title = $1,
          description = $2,
          regulation = $3,
          category = $4,
          hierarchy_level = $5,
          domain = $6,
          description_long = $7,
          updated_at = CURRENT_TIMESTAMP
        WHERE id = $8
      `;
    } else {
      query = `
        UPDATE compliance_requirements SET
          title = ?,
          description = ?,
          regulation = ?,
          category = ?,
          hierarchy_level = ?,
          domain = ?,
          description_long = ?,
          updated_at = datetime('now')
        WHERE id = ?
      `;
    }
    
    const params = [
      req.title,
      req.description,
      req.regulation || standard.name,
      req.category || 'General',
      req.hierarchy_level || 'control',
      req.domain || null,
      req.description_long || null,
      id
    ];

    await this.db.run(query, params);
  }

  async assignMetadataTags(requirementId, tags) {
    for (const tagName of tags) {
      try {
        const metadataValue = await this.findMetadataValueByName(tagName);
        if (metadataValue) {
          await this.assignMetadataToRequirement(requirementId, metadataValue.id);
          this.stats.metadataAssignments++;
        }
      } catch (error) {
        // Silently skip metadata assignment errors - tags may not exist yet
      }
    }
  }

  async findMetadataValueByName(valueName) {
    const isPostgres = this.db.isPostgres && this.db.isPostgres();
    const placeholder = isPostgres ? '$1' : '?';
    
    const query = `
      SELECT mv.* FROM metadata_values mv
      WHERE LOWER(mv.value) = LOWER(${placeholder})
    `;
    
    const rows = await this.db.all(query, [valueName]);
    return rows && rows.length > 0 ? rows[0] : null;
  }

  async assignMetadataToRequirement(requirementId, metadataValueId) {
    const isPostgres = this.db.isPostgres && this.db.isPostgres();
    
    const checkPlaceholder1 = isPostgres ? '$1' : '?';
    const checkPlaceholder2 = isPostgres ? '$2' : '?';
    const checkPlaceholder3 = isPostgres ? '$3' : '?';
    
    const checkQuery = `
      SELECT id FROM object_metadata 
      WHERE object_type = ${checkPlaceholder1} AND object_id = ${checkPlaceholder2} AND metadata_value_id = ${checkPlaceholder3}
    `;
    
    const existing = await this.db.all(checkQuery, ['requirement', requirementId, metadataValueId]);
    
    if (existing && existing.length > 0) {
      return;
    }
    
    const id = uuidv4();
    let insertQuery;
    
    if (isPostgres) {
      insertQuery = `
        INSERT INTO object_metadata (id, object_type, object_id, metadata_value_id, created_at)
        VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP)
      `;
    } else {
      insertQuery = `
        INSERT INTO object_metadata (id, object_type, object_id, metadata_value_id, created_at)
        VALUES (?, ?, ?, ?, datetime('now'))
      `;
    }
    
    await this.db.run(insertQuery, [id, 'requirement', requirementId, metadataValueId]);
  }

  printSummary() {
    console.log('\n' + '='.repeat(60));
    console.log('Import Summary');
    console.log('='.repeat(60));
    console.log(`  New records created:    ${this.stats.newRecords}`);
    console.log(`  Records updated:        ${this.stats.updatedRecords}`);
    console.log(`  Records skipped:        ${this.stats.skippedRecords}`);
    console.log(`  Metadata assignments:   ${this.stats.metadataAssignments}`);
    console.log(`  Errors:                 ${this.stats.errors.length}`);
    
    if (this.stats.errors.length > 0) {
      console.log('\nErrors:');
      this.stats.errors.forEach((err, i) => {
        console.log(`  ${i + 1}. ${err.file || err.code}: ${err.error}`);
      });
    }
    
    console.log('='.repeat(60));
  }
}

async function main() {
  const db = require('../db');
  
  try {
    await db.init();
    console.log('Database initialized successfully');
    
    const importer = new StandardsImporter(db);
    const stats = await importer.importAll();
    
    if (stats.errors.length > 0) {
      process.exit(1);
    }
    
    process.exit(0);
  } catch (error) {
    console.error('Fatal error:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = { StandardsImporter };
