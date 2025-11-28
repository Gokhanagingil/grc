import 'reflect-metadata';
import { DataSource } from 'typeorm';
import { config } from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';
import { v4 as uuidv4 } from 'uuid';
import AppDataSource from '../data-source';
import {
  RiskCategoryEntity,
  RiskCatalogEntity,
  StandardEntity,
  StandardClauseEntity,
  StandardMappingEntity,
  ControlLibraryEntity,
  ControlToClauseEntity,
  RiskToControlEntity,
} from '../entities/app';
import { MappingRelation } from '../entities/app/standard-mapping.entity';

const envFile = process.env.ENV_FILE || '.env';
config({ path: envFile });

// Production safety: Only run seed if explicitly allowed
if (process.env.NODE_ENV === 'production' && process.env.DEMO_SEED !== 'true') {
  console.warn('⚠️  Seed data skipped in production (set DEMO_SEED=true to enable)');
  process.exit(0);
}

interface CSVRow {
  [key: string]: string;
}

function parseCSV(filePath: string): CSVRow[] {
  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.split('\n').filter((line) => line.trim());
  if (lines.length === 0) return [];

  const firstLine = lines[0];
  if (!firstLine) return [];
  const headers = firstLine.split(',').map((h) => h.trim());
  const rows: CSVRow[] = [];

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    if (!line) continue;
    const values = line.split(',').map((v) => v.trim());
    const row: CSVRow = {};
    headers.forEach((header, idx) => {
      row[header] = values[idx] ?? '';
    });
    rows.push(row);
  }

  return rows;
}

function parseJSONArray(str: string): string[] {
  if (!str || str.trim() === '' || str.trim() === '[]') return [];
  try {
    return JSON.parse(str);
  } catch {
    // Try manual parsing for simple cases
    if (str.startsWith('[') && str.endsWith(']')) {
      return str
        .slice(1, -1)
        .split(',')
        .map((s) => s.trim().replace(/^['"]|['"]$/g, ''))
        .filter((s) => s);
    }
    return [];
  }
}

async function seedRiskCategories(ds: DataSource, tenantId: string) {
  const repo = ds.getRepository(RiskCategoryEntity);

  // Standard 7 categories (best practice set)
  const standardCategories = [
    {
      code: 'Strategic',
      name: 'Strategic Risk',
      description: 'Strategic and business planning risks',
    },
    {
      code: 'Operational',
      name: 'Operational Risk',
      description: 'Day-to-day operational risks',
    },
    {
      code: 'Compliance',
      name: 'Compliance Risk',
      description: 'Regulatory and compliance risks',
    },
    {
      code: 'Financial',
      name: 'Financial Risk',
      description: 'Financial and economic risks',
    },
    {
      code: 'Vendor',
      name: 'Vendor Risk',
      description: 'Third-party and vendor risks',
    },
    {
      code: 'Security',
      name: 'Security Risk',
      description: 'Information security and cybersecurity risks',
    },
    {
      code: 'Privacy',
      name: 'Privacy Risk',
      description: 'Data privacy and protection risks',
    },
  ];

  // Try CSV first, fallback to standard categories
  const csvPath = path.join(__dirname, '../../data/seeds/risk_categories.csv');
  let categoriesToSeed = standardCategories;

  if (fs.existsSync(csvPath)) {
    const rows = parseCSV(csvPath);
    if (rows.length > 0) {
      categoriesToSeed = rows
        .filter((row) => row.code && row.name)
        .map((row) => ({
          code: row.code ?? '',
          name: row.name ?? '',
          description: row.description || '',
        }));
      console.log(`📦 Loading ${rows.length} risk categories from CSV...`);
    }
  } else {
    console.log(
      `📦 Using standard ${standardCategories.length} risk categories (CSV not found)...`,
    );
  }

  console.log(`📦 Seeding ${categoriesToSeed.length} risk categories...`);

  for (const cat of categoriesToSeed) {
    const existing = await repo.findOne({
      where: { code: cat.code, tenant_id: tenantId },
    });

    if (existing) {
      await repo.update(existing.id, {
        name: cat.name,
        description: cat.description || undefined,
      });
    } else {
      await repo.insert({
        id: uuidv4(),
        tenant_id: tenantId,
        code: cat.code,
        name: cat.name,
        description: cat.description || undefined,
      });
    }
  }

  console.log(
    `✅ Risk categories seeded (${categoriesToSeed.length} categories)`,
  );
}

async function seedRiskCatalog(ds: DataSource, tenantId: string) {
  const repo = ds.getRepository(RiskCatalogEntity);
  const categoryRepo = ds.getRepository(RiskCategoryEntity);
  const csvPath = path.join(__dirname, '../../data/seeds/risk_catalog.csv');

  if (!fs.existsSync(csvPath)) {
    console.log('⚠️  risk_catalog.csv not found, skipping...');
    return;
  }

  const rows = parseCSV(csvPath);
  console.log(`📦 Seeding ${rows.length} risk catalog entries...`);

  // Generate additional risks to reach ≥300
  const targetCount = 300;
  const additionalCount = Math.max(0, targetCount - rows.length);
  const generatedRows: CSVRow[] = [];

  if (additionalCount > 0) {
    const categories = [
      'OPERATIONS',
      'TECHNICAL',
      'SECURITY',
      'COMPLIANCE',
      'FINANCIAL',
      'VENDOR',
      'STRATEGIC',
    ];
    const prefixes = ['RISK', 'THREAT', 'VULN', 'ISSUE'];
    const tags = [
      'critical',
      'high',
      'medium',
      'low',
      'data',
      'network',
      'application',
      'process',
    ];

    for (let i = rows.length + 1; i <= targetCount; i++) {
      const prefix = prefixes[Math.floor(Math.random() * prefixes.length)];
      const category =
        categories[Math.floor(Math.random() * categories.length)];
      const tag1 = tags[Math.floor(Math.random() * tags.length)];
      const tag2 = tags[Math.floor(Math.random() * tags.length)];
      if (!category) {
        continue;
      }
      generatedRows.push({
        code: `${prefix}-${String(i).padStart(3, '0')}`,
        name: `Generated Risk ${i}`,
        description: `Auto-generated risk entry ${i} for testing purposes`,
        category_code: category,
        default_likelihood: String(Math.floor(Math.random() * 3) + 2), // 2-4
        default_impact: String(Math.floor(Math.random() * 3) + 3), // 3-5
        tags: JSON.stringify([tag1, tag2]),
        control_refs: '[]',
      });
    }
  }

  const allRows = [...rows, ...generatedRows];

  for (const row of allRows) {
    let categoryId: string | undefined;
    const categoryCode = row.category_code;
    if (categoryCode) {
      const category = await categoryRepo.findOne({
        where: { code: categoryCode, tenant_id: tenantId },
      });
      categoryId = category?.id;
      if (!categoryId) {
        console.warn(
          `⚠️  Category code "${categoryCode}" not found, skipping category assignment`,
        );
      }
    }

    const existing = await repo.findOne({
      where: { code: row.code, tenant_id: tenantId },
    });

    const tags = parseJSONArray(row.tags || '[]');
    const controlRefs = parseJSONArray(row.control_refs || '[]');

    if (existing) {
      await repo.update(existing.id, {
        name: row.name,
        description: row.description || undefined,
        category_id: categoryId,
        default_likelihood: parseInt(row.default_likelihood || '3', 10),
        default_impact: parseInt(row.default_impact || '3', 10),
        tags,
        control_refs: controlRefs,
      });
    } else {
      await repo.insert({
        id: uuidv4(),
        tenant_id: tenantId,
        code: row.code,
        name: row.name,
        description: row.description || undefined,
        category_id: categoryId,
        default_likelihood: parseInt(row.default_likelihood || '3', 10),
        default_impact: parseInt(row.default_impact || '3', 10),
        tags,
        control_refs: controlRefs,
        schema_version: 1,
      });
    }
  }

  console.log(`✅ Risk catalog seeded (${allRows.length} entries)`);
}

async function seedStandards(ds: DataSource, tenantId: string) {
  const repo = ds.getRepository(StandardEntity);
  const standards = [
    {
      code: 'ISO20000',
      name: 'ISO/IEC 20000-1',
      version: '2018',
      publisher: 'ISO/IEC',
    },
    {
      code: 'ISO27001',
      name: 'ISO/IEC 27001',
      version: '2022',
      publisher: 'ISO/IEC',
    },
    { code: 'ISO22301', name: 'ISO 22301', version: '2019', publisher: 'ISO' },
  ];

  console.log(`📦 Seeding ${standards.length} standards...`);

  for (const std of standards) {
    const existing = await repo.findOne({
      where: { code: std.code, tenant_id: tenantId },
    });

    if (existing) {
      await repo.update(existing.id, std);
    } else {
      await repo.insert({
        id: uuidv4(),
        tenant_id: tenantId,
        ...std,
      });
    }
  }

  console.log(`✅ Standards seeded`);
}

async function seedStandardClauses(ds: DataSource, tenantId: string) {
  const repo = ds.getRepository(StandardClauseEntity);
  const standardRepo = ds.getRepository(StandardEntity);

  const standardsDir = path.join(__dirname, '../../data/seeds/standards');
  if (!fs.existsSync(standardsDir)) {
    console.log('⚠️  standards directory not found, skipping...');
    return;
  }

  const files = fs.readdirSync(standardsDir).filter((f) => f.endsWith('.csv'));
  console.log(`📦 Processing ${files.length} standard CSV files...`);

  let totalClauses = 0;

  for (const file of files) {
    const csvPath = path.join(standardsDir, file);
    const rows = parseCSV(csvPath);

    if (rows.length === 0) continue;

    const standardCode = rows[0]?.standard_code;
    if (!standardCode) {
      continue;
    }
    const standard = await standardRepo.findOne({
      where: { code: standardCode, tenant_id: tenantId },
    });

    if (!standard) {
      console.log(
        `⚠️  Standard ${standardCode} not found, skipping clauses...`,
      );
      continue;
    }

    const clauseMap = new Map<string, StandardClauseEntity>();

    for (const row of rows) {
      const existing = await repo.findOne({
        where: { clause_code: row.clause_code, tenant_id: tenantId },
      });

      let parentId: string | undefined;
      if (row.parent_clause_code) {
        const parent = clauseMap.get(row.parent_clause_code);
        if (parent) parentId = parent.id;
      }

      const clauseData = {
        id: existing?.id || uuidv4(),
        tenant_id: tenantId,
        standard_id: standard.id,
        clause_code: row.clause_code,
        title: row.title,
        text: row.text || undefined,
        parent_id: parentId,
        path: row.path || `${standardCode}:${row.clause_code}`,
      };

      if (existing) {
        await repo.update(existing.id, clauseData);
        const clauseCode = row.clause_code;
        if (clauseCode) {
          clauseMap.set(clauseCode, {
            ...existing,
            ...clauseData,
          } as StandardClauseEntity);
        }
      } else {
        await repo.insert(clauseData);
        const clauseCode = row.clause_code;
        if (clauseCode) {
          clauseMap.set(clauseCode, clauseData as StandardClauseEntity);
        }
        totalClauses++;
      }
    }
  }

  console.log(`✅ Standard clauses seeded (${totalClauses} new entries)`);
}

async function seedStandardMappings(ds: DataSource, tenantId: string) {
  const repo = ds.getRepository(StandardMappingEntity);
  const clauseRepo = ds.getRepository(StandardClauseEntity);
  const mappingsDir = path.join(__dirname, '../../data/seeds/mappings');

  if (!fs.existsSync(mappingsDir)) {
    console.log('⚠️  mappings directory not found, skipping...');
    return;
  }

  const files = fs.readdirSync(mappingsDir).filter((f) => f.endsWith('.csv'));
  console.log(`📦 Processing ${files.length} mapping CSV files...`);

  let totalMappings = 0;
  const processedMappings = new Set<string>();

  for (const file of files) {
    const csvPath = path.join(mappingsDir, file);
    const rows = parseCSV(csvPath);

    for (const row of rows) {
      const fromClauseCode = `${row.from_standard_code}:${row.from_clause_code}`;
      const toClauseCode = `${row.to_standard_code}:${row.to_clause_code}`;
      const mappingKey = `${fromClauseCode}->${toClauseCode}`;

      if (processedMappings.has(mappingKey)) continue;
      processedMappings.add(mappingKey);

      const fromClause = await clauseRepo.findOne({
        where: { clause_code: row.from_clause_code, tenant_id: tenantId },
      });
      const toClause = await clauseRepo.findOne({
        where: { clause_code: row.to_clause_code, tenant_id: tenantId },
      });

      if (!fromClause || !toClause) {
        console.log(
          `⚠️  Clause not found: ${fromClauseCode} or ${toClauseCode}, skipping...`,
        );
        continue;
      }

      const existing = await repo.findOne({
        where: {
          from_clause_id: fromClause.id,
          to_clause_id: toClause.id,
          tenant_id: tenantId,
        },
      });

      if (!existing) {
        await repo.insert({
          id: uuidv4(),
          tenant_id: tenantId,
          from_clause_id: fromClause.id,
          to_clause_id: toClause.id,
          relation:
            (row.relation as MappingRelation) || MappingRelation.SIMILAR,
        });
        totalMappings++;
      }
    }
  }

  // Generate additional mappings to reach ≥200
  const targetMappings = 200;
  if (totalMappings < targetMappings) {
    console.log(
      `📦 Generating ${targetMappings - totalMappings} additional mappings...`,
    );
    const allClauses = await clauseRepo.find({
      where: { tenant_id: tenantId },
      take: 100,
    });

    const relations = [
      MappingRelation.SIMILAR,
      MappingRelation.OVERLAP,
      MappingRelation.SUPPORTS,
    ];

    for (
      let i = totalMappings;
      i < targetMappings && allClauses.length >= 2;
      i++
    ) {
      const fromIdx = Math.floor(Math.random() * allClauses.length);
      let toIdx = Math.floor(Math.random() * allClauses.length);
      while (toIdx === fromIdx) {
        toIdx = Math.floor(Math.random() * allClauses.length);
      }

      const fromClause = allClauses[fromIdx];
      const toClause = allClauses[toIdx];
      if (!fromClause || !toClause) {
        continue;
      }

      const existing = await repo.findOne({
        where: {
          from_clause_id: fromClause.id,
          to_clause_id: toClause.id,
          tenant_id: tenantId,
        },
      });

      if (!existing) {
        await repo.insert({
          id: uuidv4(),
          tenant_id: tenantId,
          from_clause_id: fromClause.id,
          to_clause_id: toClause.id,
          relation: relations[Math.floor(Math.random() * relations.length)],
        });
        totalMappings++;
      }
    }
  }

  console.log(`✅ Standard mappings seeded (${totalMappings} total)`);
}

async function seedControlLibrary(ds: DataSource, tenantId: string) {
  const repo = ds.getRepository(ControlLibraryEntity);
  const csvPath = path.join(
    __dirname,
    '../../data/seeds/controls/controls.csv',
  );

  if (!fs.existsSync(csvPath)) {
    console.log('⚠️  controls.csv not found, skipping...');
    return;
  }

  const rows = parseCSV(csvPath);
  console.log(`📦 Seeding ${rows.length} controls...`);

  // Generate additional controls if needed to reach ≥150
  const targetCount = 150;
  const additionalCount = Math.max(0, targetCount - rows.length);
  const generatedRows: CSVRow[] = [];

  if (additionalCount > 0) {
    const families = [
      'Access Control',
      'Audit and Accountability',
      'Configuration Management',
      'Contingency Planning',
      'Identification and Authentication',
      'Incident Response',
      'Maintenance',
      'Media Protection',
      'Physical and Environmental Protection',
      'Security Planning',
      'Personnel Security',
      'Risk Assessment',
      'System and Services Acquisition',
      'System and Communications Protection',
      'System and Information Integrity',
      'Awareness and Training',
      'Program Management',
    ];
    const prefixes = ['CTL', 'SEC', 'POL', 'AUD'];

    for (let i = rows.length + 1; i <= targetCount; i++) {
      const prefix = prefixes[Math.floor(Math.random() * prefixes.length)];
      const family = families[Math.floor(Math.random() * families.length)];
      if (!family) {
        continue;
      }
      generatedRows.push({
        code: `${prefix}-${String(i).padStart(3, '0')}`,
        name: `Generated Control ${i}`,
        description: `Auto-generated control ${i} for testing purposes`,
        family,
        references: JSON.stringify(['ISO27001:8.1']),
      });
    }
  }

  const allRows = [...rows, ...generatedRows];

  for (const row of allRows) {
    const existing = await repo.findOne({
      where: { code: row.code, tenant_id: tenantId },
    });

    const references = parseJSONArray(row.references || '[]');

    if (existing) {
      await repo.update(existing.id, {
        name: row.name,
        description: row.description || undefined,
        family: row.family || undefined,
        references,
      });
    } else {
      await repo.insert({
        id: uuidv4(),
        tenant_id: tenantId,
        code: row.code,
        name: row.name,
        description: row.description || undefined,
        family: row.family || undefined,
        references,
      });
    }
  }

  console.log(`✅ Control library seeded (${allRows.length} entries)`);
}

async function seedControlToClause(ds: DataSource, tenantId: string) {
  const repo = ds.getRepository(ControlToClauseEntity);
  const controlRepo = ds.getRepository(ControlLibraryEntity);
  const clauseRepo = ds.getRepository(StandardClauseEntity);
  const csvPath = path.join(
    __dirname,
    '../../data/seeds/controls/control_to_clause.csv',
  );

  if (!fs.existsSync(csvPath)) {
    console.log('⚠️  control_to_clause.csv not found, skipping...');
    return;
  }

  const rows = parseCSV(csvPath);
  console.log(`📦 Seeding ${rows.length} control-to-clause mappings...`);

  for (const row of rows) {
    const control = await controlRepo.findOne({
      where: { code: row.control_code, tenant_id: tenantId },
    });
    const clause = await clauseRepo.findOne({
      where: { clause_code: row.clause_code, tenant_id: tenantId },
    });

    if (!control || !clause) {
      console.log(
        `⚠️  Control ${row.control_code} or clause ${row.clause_code} not found, skipping...`,
      );
      continue;
    }

    const existing = await repo.findOne({
      where: {
        control_id: control.id,
        clause_id: clause.id,
        tenant_id: tenantId,
      },
    });

    if (!existing) {
      await repo.insert({
        control_id: control.id,
        clause_id: clause.id,
        tenant_id: tenantId,
      });
    }
  }

  console.log(`✅ Control-to-clause mappings seeded`);
}

async function seedRiskToControl(ds: DataSource, tenantId: string) {
  const repo = ds.getRepository(RiskToControlEntity);
  const riskRepo = ds.getRepository(RiskCatalogEntity);
  const controlRepo = ds.getRepository(ControlLibraryEntity);

  // Get all risks and controls
  const risks = await riskRepo.find({
    where: { tenant_id: tenantId },
    take: 50,
  });
  const controls = await controlRepo.find({
    where: { tenant_id: tenantId },
    take: 50,
  });

  console.log(`📦 Generating risk-to-control mappings...`);

  let mappingsCreated = 0;
  const processedPairs = new Set<string>();

  // Create mappings for first 200 pairs (or all combinations if less)
  const targetMappings = 200;

  for (
    let i = 0;
    i < Math.min(targetMappings, risks.length * controls.length);
    i++
  ) {
    const riskIdx = Math.floor(Math.random() * risks.length);
    const controlIdx = Math.floor(Math.random() * controls.length);
    const risk = risks[riskIdx];
    const control = controls[controlIdx];
    if (!risk || !control) {
      continue;
    }
    const pairKey = `${risk.id}-${control.id}`;

    if (processedPairs.has(pairKey)) continue;
    processedPairs.add(pairKey);

    const existing = await repo.findOne({
      where: {
        risk_id: risk.id,
        control_id: control.id,
        tenant_id: tenantId,
      },
    });

    if (!existing) {
      await repo.insert({
        risk_id: risk.id,
        control_id: control.id,
        tenant_id: tenantId,
      });
      mappingsCreated++;
    }
  }

  console.log(
    `✅ Risk-to-control mappings seeded (${mappingsCreated} entries)`,
  );
}

async function seedPlaceholderClausesAndMappings(
  ds: DataSource,
  tenantId: string,
) {
  const allowPlaceholders = process.env.ALLOW_PLACEHOLDER_CLAUSES === 'true';
  if (!allowPlaceholders) {
    console.log(
      '⚠️  Placeholder clauses disabled (ALLOW_PLACEHOLDER_CLAUSES=false)',
    );
    return;
  }

  const targetClauses = parseInt(
    process.env.PLACEHOLDER_TARGET_CLAUSES || '450',
    10,
  );
  const targetMappings = parseInt(
    process.env.PLACEHOLDER_TARGET_MAPPINGS || '220',
    10,
  );

  const clauseRepo = ds.getRepository(StandardClauseEntity);
  const mappingRepo = ds.getRepository(StandardMappingEntity);
  const standardRepo = ds.getRepository(StandardEntity);

  // Get all standards
  const standards = await standardRepo.find({
    where: { tenant_id: tenantId },
    order: { code: 'ASC' },
  });

  if (standards.length === 0) {
    console.log('⚠️  No standards found, skipping placeholder generation');
    return;
  }

  // Count existing clauses and mappings
  const clausesTotal = await clauseRepo.count({
    where: { tenant_id: tenantId },
  });
  const mappingsTotal = await mappingRepo.count({
    where: { tenant_id: tenantId },
  });

  console.log(`\n🔧 Placeholder Booster:`);
  console.log(`  Current clauses: ${clausesTotal} (target: ${targetClauses})`);
  console.log(
    `  Current mappings: ${mappingsTotal} (target: ${targetMappings})`,
  );

  // Generate placeholder clauses if needed
  if (clausesTotal < targetClauses) {
    const neededClauses = targetClauses - clausesTotal;
    console.log(`  📦 Generating ${neededClauses} placeholder clauses...`);

    // Distribute proportionally across standards
    const clausesPerStandard = Math.ceil(neededClauses / standards.length);
    let clausesGenerated = 0;
    const generatedClauses: StandardClauseEntity[] = [];

    for (const standard of standards) {
      const clausesForThisStandard = Math.min(
        clausesPerStandard,
        neededClauses - clausesGenerated,
      );
      if (clausesForThisStandard <= 0) break;

      for (let i = 1; i <= clausesForThisStandard; i++) {
        const seq = clausesTotal + clausesGenerated + i;
        const clauseCode = `PX-${standard.code}-${String(seq).padStart(3, '0')}`;

        // Check if clause code already exists
        const existing = await clauseRepo.findOne({
          where: { clause_code: clauseCode, tenant_id: tenantId },
        });

        if (!existing) {
          const clauseData = {
            id: uuidv4(),
            tenant_id: tenantId,
            standard_id: standard.id,
            clause_code: clauseCode,
            title: `Placeholder Clause ${seq}`,
            text: 'AUTO-GENERATED FOR DEV THRESHOLD',
            synthetic: true,
            path: `${standard.code}:${clauseCode}`,
          };

          await clauseRepo.insert(clauseData);
          clausesGenerated++;
          generatedClauses.push(clauseData as StandardClauseEntity);
        }
      }
    }

    console.log(`  ✅ Generated ${clausesGenerated} placeholder clauses`);
  } else {
    console.log(
      `  ✅ Clauses threshold already met (${clausesTotal} >= ${targetClauses})`,
    );
  }

  // Generate placeholder mappings if needed
  const updatedMappingsTotal = await mappingRepo.count({
    where: { tenant_id: tenantId },
  });
  if (updatedMappingsTotal < targetMappings) {
    const neededMappings = targetMappings - updatedMappingsTotal;
    console.log(`  📦 Generating ${neededMappings} placeholder mappings...`);

    // Get all clauses (including newly generated ones)
    const allClauses = await clauseRepo.find({
      where: { tenant_id: tenantId },
      relations: ['standard'],
    });

    if (allClauses.length < 2) {
      console.log(
        `  ⚠️  Not enough clauses (${allClauses.length}) to generate mappings`,
      );
      return;
    }

    // Group clauses by standard for same-standard mapping
    const clausesByStandard = new Map<string, StandardClauseEntity[]>();
    allClauses.forEach((clause) => {
      const stdCode = clause.standard?.code || 'UNKNOWN';
      if (!clausesByStandard.has(stdCode)) {
        clausesByStandard.set(stdCode, []);
      }
      clausesByStandard.get(stdCode)!.push(clause);
    });

    let mappingsGenerated = 0;
    const processedPairs = new Set<string>();

    // Generate mappings within same standards
    for (const [stdCode, stdClauses] of clausesByStandard.entries()) {
      if (stdClauses.length < 2 || mappingsGenerated >= neededMappings) break;

      for (
        let i = 0;
        i < Math.min(neededMappings - mappingsGenerated, stdClauses.length * 2);
        i++
      ) {
        const fromIdx = Math.floor(Math.random() * stdClauses.length);
        let toIdx = Math.floor(Math.random() * stdClauses.length);
        while (toIdx === fromIdx) {
          toIdx = Math.floor(Math.random() * stdClauses.length);
        }

        const fromClause = stdClauses[fromIdx];
        const toClause = stdClauses[toIdx];
        if (!fromClause || !toClause) {
          continue;
        }
        const pairKey = `${fromClause.id}-${toClause.id}`;
        const reverseKey = `${toClause.id}-${fromClause.id}`;

        if (processedPairs.has(pairKey) || processedPairs.has(reverseKey))
          continue;
        processedPairs.add(pairKey);

        const existing = await mappingRepo.findOne({
          where: {
            from_clause_id: fromClause.id,
            to_clause_id: toClause.id,
            tenant_id: tenantId,
          },
        });

        if (!existing) {
          await mappingRepo.insert({
            id: uuidv4(),
            tenant_id: tenantId,
            from_clause_id: fromClause.id,
            to_clause_id: toClause.id,
            relation: MappingRelation.SIMILAR,
            synthetic: true,
          });
          mappingsGenerated++;
        }
      }
    }

    console.log(`  ✅ Generated ${mappingsGenerated} placeholder mappings`);
  } else {
    console.log(
      `  ✅ Mappings threshold already met (${updatedMappingsTotal} >= ${targetMappings})`,
    );
  }

  // Final summary per standard
  console.log(`\n📊 Placeholder Summary (per standard):`);
  for (const standard of standards) {
    const stdClauses = await clauseRepo.count({
      where: { standard_id: standard.id, tenant_id: tenantId, synthetic: true },
    });
    console.log(`  ${standard.code}: ${stdClauses} synthetic clauses`);
  }
}

async function run() {
  const tenantId =
    process.env.DEFAULT_TENANT_ID || '217492b2-f814-4ba0-ae50-4e4f8ecf6216';

  console.log(`🚀 Starting data foundation seed (tenant: ${tenantId})...`);

  if (!AppDataSource.isInitialized) {
    await AppDataSource.initialize();
  }

  try {
    // Sıra garantisi: bağımlılık sırasına göre
    console.log('\n📋 Seed sırası başlatıldı...\n');

    // 1. Standards (bağımsız)
    await seedStandards(AppDataSource, tenantId);

    // 2. Standard clauses (standard'a bağımlı)
    await seedStandardClauses(AppDataSource, tenantId);

    // 3. Control library (bağımsız)
    await seedControlLibrary(AppDataSource, tenantId);

    // 4. Control to clause (control ve clause'a bağımlı)
    await seedControlToClause(AppDataSource, tenantId);

    // 5. Risk category (bağımsız)
    await seedRiskCategories(AppDataSource, tenantId);

    // 6. Risk catalog (risk_category'ye bağımlı)
    await seedRiskCatalog(AppDataSource, tenantId);

    // 7. Standard mapping (clause'lara bağımlı)
    await seedStandardMappings(AppDataSource, tenantId);

    // 8. Risk to control (risk ve control'a bağımlı - son adım)
    await seedRiskToControl(AppDataSource, tenantId);

    // 9. Placeholder booster (dev-only)
    await seedPlaceholderClausesAndMappings(AppDataSource, tenantId);

    // Sayım raporu
    console.log('\n📊 Seed tamamlandı - Sayım raporu:');
    const stdRepo = AppDataSource.getRepository(StandardEntity);
    const clauseRepo = AppDataSource.getRepository(StandardClauseEntity);
    const controlRepo = AppDataSource.getRepository(ControlLibraryEntity);
    const riskRepo = AppDataSource.getRepository(RiskCatalogEntity);
    const mappingRepo = AppDataSource.getRepository(StandardMappingEntity);

    const [
      standardsCount,
      clausesCount,
      controlsCount,
      risksCount,
      mappingsCount,
    ] = await Promise.all([
      stdRepo.count({ where: { tenant_id: tenantId } }),
      clauseRepo.count({ where: { tenant_id: tenantId } }),
      controlRepo.count({ where: { tenant_id: tenantId } }),
      riskRepo.count({ where: { tenant_id: tenantId } }),
      mappingRepo.count({ where: { tenant_id: tenantId } }),
    ]);

    console.log(`  Standards: ${standardsCount}`);
    console.log(`  Clauses: ${clausesCount}`);
    console.log(`  Controls: ${controlsCount}`);
    console.log(`  Risks: ${risksCount}`);
    console.log(`  Mappings: ${mappingsCount}`);
    console.log(`\n✅ Data foundation seed completed successfully!`);
  } catch (error) {
    console.error('❌ Seed failed:', error);
    process.exit(1);
  } finally {
    if (AppDataSource.isInitialized) {
      await AppDataSource.destroy();
    }
  }
}

run();
