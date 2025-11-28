#!/usr/bin/env ts-node
/**
 * Seed Standards & Clauses
 * 
 * Seeds real-world standards (ISO 27001, ISO 20000, PCI DSS) with sample clauses
 */

import 'reflect-metadata';
import { config } from 'dotenv';
import { DataSource, DataSourceOptions } from 'typeorm';
import * as path from 'path';
import * as fs from 'fs';
import { randomUUID } from 'crypto';
import { StandardEntity } from '../src/entities/app/standard.entity';
import { StandardClauseEntity } from '../src/entities/app/standard-clause.entity';
import { TenantEntity } from '../src/entities/tenant/tenant.entity';

const envFile = process.env.ENV_FILE || '.env';
config({ path: envFile });

const DEFAULT_TENANT_ID =
  process.env.DEFAULT_TENANT_ID || '217492b2-f814-4ba0-ae50-4e4f8ecf6216';

// Standards data
const standards = [
  {
    code: 'ISO27001',
    name: 'ISO/IEC 27001:2022',
    version: '2022',
    publisher: 'ISO/IEC',
    clauses: [
      { clause_code: '5.1', title: 'Policies for information security', text: 'Policies for information security shall be defined, approved by management, published, communicated to and acknowledged by relevant personnel, and reviewed at planned intervals.' },
      { clause_code: '5.2', title: 'Roles and responsibilities', text: 'Roles and responsibilities for information security shall be defined and allocated.' },
      { clause_code: '5.3', title: 'Segregation of duties', text: 'Conflicting duties and areas of responsibility shall be segregated to reduce opportunities for unauthorized or unintentional modification or misuse of the organization\'s assets.' },
      { clause_code: '6.1', title: 'Actions to address risks and opportunities', text: 'The organization shall plan actions to address information security risks and information security opportunities.' },
      { clause_code: '6.2', title: 'Information security objectives', text: 'Information security objectives shall be established at relevant functions and levels.' },
      { clause_code: '7.1', title: 'Resources', text: 'The organization shall determine and provide the resources needed for the establishment, implementation, maintenance and continual improvement of the information security management system.' },
      { clause_code: '7.2', title: 'Competence', text: 'The organization shall determine the necessary competence of person(s) doing work under its control that affects the information security performance.' },
      { clause_code: '7.3', title: 'Awareness', text: 'Persons doing work under the organization\'s control shall be aware of the information security policy and their contribution to the effectiveness of the information security management system.' },
      { clause_code: 'A.5.1.1', title: 'Policies for information security', text: 'Policies for information security shall be defined, approved by management, published, communicated to and acknowledged by relevant personnel, and reviewed at planned intervals.' },
      { clause_code: 'A.5.1.2', title: 'Review of policies for information security', text: 'Policies for information security shall be reviewed at planned intervals or if significant changes occur.' },
      { clause_code: 'A.5.2.1', title: 'Roles and responsibilities', text: 'Roles and responsibilities for information security shall be defined and allocated.' },
      { clause_code: 'A.5.2.2', title: 'Segregation of duties', text: 'Conflicting duties and areas of responsibility shall be segregated to reduce opportunities for unauthorized or unintentional modification or misuse of the organization\'s assets.' },
      { clause_code: 'A.5.3.1', title: 'Management commitment to information security', text: 'Top management shall demonstrate leadership and commitment with respect to the information security management system.' },
      { clause_code: 'A.6.1.1', title: 'Screening', text: 'Background verification checks on all candidates for employment shall be carried out in accordance with relevant laws, regulations and ethics, and proportional to the business requirements, the classification of the information to be accessed and the perceived risks.' },
      { clause_code: 'A.6.1.2', title: 'Terms and conditions of employment', text: 'The contractual agreements with employees and contractors shall state their and the organization\'s responsibilities for information security.' },
      { clause_code: 'A.7.1.1', title: 'Physical security perimeters', text: 'Physical security perimeters shall be defined and used to protect areas that contain either sensitive or critical information and information processing facilities.' },
      { clause_code: 'A.7.2.1', title: 'Physical entry controls', text: 'Secure areas shall be protected by appropriate entry controls to ensure that only authorized personnel are allowed access.' },
      { clause_code: 'A.8.1.1', title: 'Inventory of assets', text: 'Assets associated with information and information processing facilities shall be identified and an inventory of these assets shall be drawn up and maintained.' },
      { clause_code: 'A.8.2.1', title: 'Classification of information', text: 'Information shall be classified in terms of legal requirements, value, criticality and sensitivity to unauthorized disclosure or modification.' },
      { clause_code: 'A.9.1.1', title: 'Access control policy', text: 'An access control policy shall be established, documented and reviewed based on business and information security requirements.' },
      { clause_code: 'A.9.2.1', title: 'User registration and de-registration', text: 'A formal user registration and de-registration process shall be implemented to enable assignment of access rights.' },
      { clause_code: 'A.9.3.1', title: 'Management of secret authentication information', text: 'Secret authentication information shall be managed securely.' },
      { clause_code: 'A.10.1.1', title: 'Cryptographic controls', text: 'A policy on the use of cryptographic controls for protection of information shall be developed and implemented.' },
      { clause_code: 'A.11.1.1', title: 'Physical and environmental security', text: 'Physical and environmental security controls shall be implemented to protect information processing facilities.' },
      { clause_code: 'A.12.1.1', title: 'Documented operating procedures', text: 'Operating procedures shall be documented and made available to all users who need them.' },
      { clause_code: 'A.12.2.1', title: 'Change management', text: 'Changes to information processing facilities and systems shall be controlled.' },
      { clause_code: 'A.13.1.1', title: 'Network security management', text: 'Networks shall be managed and controlled to protect information in systems and applications.' },
      { clause_code: 'A.14.1.1', title: 'Security requirements of information systems', text: 'Security requirements shall be identified and agreed prior to the development or acquisition of information systems.' },
      { clause_code: 'A.15.1.1', title: 'Information security in supplier relationships', text: 'Processes and procedures shall be established and applied to manage information security in supplier relationships.' },
      { clause_code: 'A.16.1.1', title: 'Management of information security incidents', text: 'Information security events shall be assessed and it shall be decided if they are to be classified as information security incidents.' },
      { clause_code: 'A.17.1.1', title: 'Information security continuity', text: 'Information security continuity shall be embedded in the organization\'s business continuity management systems.' },
      { clause_code: 'A.18.1.1', title: 'Compliance with legal and contractual requirements', text: 'All relevant legislative, statutory, regulatory and contractual requirements and the organization\'s approach to meet these requirements shall be explicitly identified, documented and kept up to date.' },
    ],
  },
  {
    code: 'ISO20000',
    name: 'ISO/IEC 20000-1:2018',
    version: '2018',
    publisher: 'ISO/IEC',
    clauses: [
      { clause_code: '4.1', title: 'Understanding the organization and its context', text: 'The organization shall determine external and internal issues that are relevant to its purpose and that affect its ability to achieve the intended outcome(s) of its service management system.' },
      { clause_code: '4.2', title: 'Understanding the needs and expectations of interested parties', text: 'The organization shall determine the interested parties that are relevant to the service management system and the requirements of these interested parties.' },
      { clause_code: '4.3', title: 'Determining the scope of the service management system', text: 'The organization shall determine the boundaries and applicability of the service management system to establish its scope.' },
      { clause_code: '4.4', title: 'Service management system', text: 'The organization shall establish, implement, maintain and continually improve a service management system, including the processes needed and their interactions, in accordance with the requirements of this document.' },
      { clause_code: '5.1', title: 'Leadership and commitment', text: 'Top management shall demonstrate leadership and commitment with respect to the service management system.' },
      { clause_code: '5.2', title: 'Policy', text: 'Top management shall establish a service management policy that is appropriate to the purpose of the organization.' },
      { clause_code: '5.3', title: 'Organizational roles, responsibilities and authorities', text: 'Top management shall ensure that the responsibilities and authorities for relevant roles are assigned and communicated within the organization.' },
      { clause_code: '6.1', title: 'Actions to address risks and opportunities', text: 'The organization shall determine the risks and opportunities that need to be addressed to give assurance that the service management system can achieve its intended outcome(s).' },
      { clause_code: '6.2', title: 'Service management objectives and planning to achieve them', text: 'The organization shall establish service management objectives at relevant functions and levels.' },
      { clause_code: '7.1', title: 'Resources', text: 'The organization shall determine and provide the resources needed for the establishment, implementation, maintenance and continual improvement of the service management system.' },
      { clause_code: '7.2', title: 'Competence', text: 'The organization shall determine the necessary competence of person(s) doing work under its control that affects its service management performance.' },
      { clause_code: '7.3', title: 'Awareness', text: 'Persons doing work under the organization\'s control shall be aware of the service management policy, relevant service management objectives, their contribution to the effectiveness of the service management system, and the implications of not conforming with the service management system requirements.' },
      { clause_code: '8.1', title: 'Operational planning and control', text: 'The organization shall plan, implement and control the processes needed to meet service management requirements, and to implement the actions determined in clause 6.1.' },
      { clause_code: '8.2', title: 'Service portfolio', text: 'The organization shall establish and maintain a service portfolio.' },
      { clause_code: '8.3', title: 'Relationship and agreement management', text: 'The organization shall establish and maintain relationships with customers, suppliers and partners.' },
      { clause_code: '8.4', title: 'Supply and demand management', text: 'The organization shall plan, implement and control the processes needed to manage supply and demand for services.' },
      { clause_code: '8.5', title: 'Service design, build and transition', text: 'The organization shall design, build and transition new or changed services.' },
      { clause_code: '8.6', title: 'Resolution and fulfilment', text: 'The organization shall resolve incidents and fulfil service requests.' },
      { clause_code: '8.7', title: 'Service assurance', text: 'The organization shall ensure that services meet agreed requirements.' },
      { clause_code: '9.1', title: 'Monitoring, measurement, analysis and evaluation', text: 'The organization shall determine what needs to be monitored and measured, the methods for monitoring, measurement, analysis and evaluation needed to ensure valid results.' },
      { clause_code: '9.2', title: 'Internal audit', text: 'The organization shall conduct internal audits at planned intervals to provide information on whether the service management system conforms to the organization\'s own requirements for its service management system and to the requirements of this document.' },
      { clause_code: '9.3', title: 'Management review', text: 'Top management shall review the organization\'s service management system, at planned intervals, to ensure its continuing suitability, adequacy and effectiveness.' },
      { clause_code: '10.1', title: 'Nonconformity and corrective action', text: 'When a nonconformity occurs, the organization shall react to the nonconformity and, as applicable, take action to control and correct it and deal with the consequences.' },
      { clause_code: '10.2', title: 'Continual improvement', text: 'The organization shall continually improve the suitability, adequacy and effectiveness of the service management system.' },
    ],
  },
  {
    code: 'ISO9001',
    name: 'ISO 9001:2015',
    version: '2015',
    publisher: 'ISO',
    clauses: [
      { clause_code: '4.1', title: 'Understanding the organization and its context', text: 'The organization shall determine external and internal issues that are relevant to its purpose and its strategic direction and that affect its ability to achieve the intended result(s) of its quality management system.' },
      { clause_code: '4.2', title: 'Understanding the needs and expectations of interested parties', text: 'The organization shall determine the interested parties relevant to the quality management system and the requirements of these interested parties.' },
      { clause_code: '4.3', title: 'Determining the scope of the quality management system', text: 'The organization shall determine the boundaries and applicability of the quality management system to establish its scope.' },
      { clause_code: '4.4', title: 'Quality management system and its processes', text: 'The organization shall establish, implement, maintain and continually improve the quality management system, including the processes needed and their interactions.' },
      { clause_code: '5.1', title: 'Leadership and commitment', text: 'Top management shall demonstrate leadership and commitment with respect to the quality management system.' },
      { clause_code: '5.2', title: 'Policy', text: 'Top management shall establish, implement and maintain a quality policy.' },
      { clause_code: '5.3', title: 'Organizational roles, responsibilities and authorities', text: 'Top management shall ensure that the responsibilities and authorities for relevant roles are assigned, communicated and understood within the organization.' },
      { clause_code: '6.1', title: 'Actions to address risks and opportunities', text: 'When planning for the quality management system, the organization shall consider the issues referred to in 4.1 and the requirements referred to in 4.2 and determine the risks and opportunities that need to be addressed.' },
      { clause_code: '6.2', title: 'Quality objectives and planning to achieve them', text: 'The organization shall establish quality objectives at relevant functions, levels and processes needed for the quality management system.' },
      { clause_code: '7.1', title: 'Resources', text: 'The organization shall determine and provide the resources needed for the establishment, implementation, maintenance and continual improvement of the quality management system.' },
      { clause_code: '7.2', title: 'Competence', text: 'The organization shall determine the necessary competence of person(s) doing work under its control that affects the performance and effectiveness of the quality management system.' },
      { clause_code: '7.3', title: 'Awareness', text: 'The organization shall ensure that persons doing work under the organization\'s control are aware of the quality policy, relevant quality objectives, their contribution to the effectiveness of the quality management system, and the implications of not conforming with the quality management system requirements.' },
      { clause_code: '8.1', title: 'Operational planning and control', text: 'The organization shall plan, implement and control the processes needed to meet the requirements for the provision of products and services, and to implement the actions determined in clause 6.1.' },
      { clause_code: '8.2', title: 'Requirements for products and services', text: 'The organization shall ensure that it has the ability to meet the requirements for products and services to be offered to customers.' },
      { clause_code: '8.3', title: 'Design and development of products and services', text: 'The organization shall establish, implement and maintain a design and development process that is appropriate to ensure the subsequent provision of products and services.' },
      { clause_code: '8.4', title: 'Control of externally provided processes, products and services', text: 'The organization shall ensure that externally provided processes, products and services conform to specified requirements.' },
      { clause_code: '8.5', title: 'Production and service provision', text: 'The organization shall implement production and service provision under controlled conditions.' },
      { clause_code: '8.6', title: 'Release of products and services', text: 'The organization shall implement planned arrangements, at appropriate stages, to verify that the product and service requirements have been met.' },
      { clause_code: '8.7', title: 'Control of nonconforming outputs', text: 'The organization shall ensure that outputs that do not conform to their requirements are identified and controlled to prevent their unintended use or delivery.' },
      { clause_code: '9.1', title: 'Monitoring, measurement, analysis and evaluation', text: 'The organization shall determine what needs to be monitored and measured, the methods for monitoring, measurement, analysis and evaluation needed to ensure valid results.' },
      { clause_code: '9.2', title: 'Internal audit', text: 'The organization shall conduct internal audits at planned intervals to provide information on whether the quality management system conforms to the organization\'s own requirements for its quality management system and to the requirements of this International Standard.' },
      { clause_code: '9.3', title: 'Management review', text: 'Top management shall review the organization\'s quality management system, at planned intervals, to ensure its continuing suitability, adequacy, effectiveness and alignment with the strategic direction of the organization.' },
      { clause_code: '10.1', title: 'General', text: 'The organization shall determine opportunities for improvement and implement any necessary actions to meet customer requirements and enhance customer satisfaction.' },
      { clause_code: '10.2', title: 'Nonconformity and corrective action', text: 'When a nonconformity occurs, the organization shall react to the nonconformity and, as applicable, take action to control and correct it and deal with the consequences.' },
      { clause_code: '10.3', title: 'Continual improvement', text: 'The organization shall continually improve the suitability, adequacy and effectiveness of the quality management system.' },
    ],
  },
  {
    code: 'ISO31000',
    name: 'ISO 31000:2018',
    version: '2018',
    publisher: 'ISO',
    clauses: [
      { clause_code: '5.1', title: 'General', text: 'Leadership and commitment are essential for the effective management of risk.' },
      { clause_code: '5.2', title: 'Integration', text: 'Risk management should be integrated into all organizational activities.' },
      { clause_code: '5.3', title: 'Design', text: 'The organization should design a framework for managing risk that is appropriate to the organization.' },
      { clause_code: '5.4', title: 'Implementation', text: 'The organization should implement the risk management framework.' },
      { clause_code: '5.5', title: 'Evaluation', text: 'The organization should evaluate the effectiveness of the risk management framework.' },
      { clause_code: '5.6', title: 'Improvement', text: 'The organization should continually improve the suitability, adequacy and effectiveness of the risk management framework.' },
      { clause_code: '6.1', title: 'General', text: 'Risk assessment is the overall process of risk identification, risk analysis and risk evaluation.' },
      { clause_code: '6.2', title: 'Risk identification', text: 'The organization should identify sources of risk, areas of impacts, events and their causes and their potential consequences.' },
      { clause_code: '6.3', title: 'Risk analysis', text: 'Risk analysis involves consideration of the causes and sources of risk, their positive and negative consequences, and the likelihood that those consequences can occur.' },
      { clause_code: '6.4', title: 'Risk evaluation', text: 'Risk evaluation involves comparing the results of the risk analysis with the risk criteria to determine whether the risk and/or its magnitude is acceptable or tolerable.' },
      { clause_code: '6.5', title: 'Risk treatment', text: 'Risk treatment involves selecting one or more options for modifying risk, and implementing those options.' },
      { clause_code: '8.1', title: 'General', text: 'Risk treatment involves a cyclical process of formulating and selecting risk treatment options, planning and implementing risk treatment, assessing the effectiveness of that treatment, and deciding whether the remaining risk is acceptable.' },
      { clause_code: '8.2', title: 'Selection of risk treatment options', text: 'The organization should select appropriate risk treatment options that take into account the values, perceptions and opinions of stakeholders, and the most appropriate ways to communicate with them.' },
      { clause_code: '8.3', title: 'Planning and implementing risk treatment', text: 'The organization should plan and implement risk treatment.' },
      { clause_code: '8.4', title: 'Residual risk', text: 'After risk treatment, there is usually some residual risk remaining.' },
    ],
  },
  {
    code: 'ISO22301',
    name: 'ISO 22301:2019',
    version: '2019',
    publisher: 'ISO',
    clauses: [
      { clause_code: '4.1', title: 'Understanding the organization and its context', text: 'The organization shall determine external and internal issues that are relevant to its purpose and that affect its ability to achieve the intended outcome(s) of its business continuity management system.' },
      { clause_code: '4.2', title: 'Understanding the needs and expectations of interested parties', text: 'The organization shall determine the interested parties that are relevant to the business continuity management system and the requirements of these interested parties.' },
      { clause_code: '4.3', title: 'Determining the scope of the business continuity management system', text: 'The organization shall determine the boundaries and applicability of the business continuity management system to establish its scope.' },
      { clause_code: '4.4', title: 'Business continuity management system', text: 'The organization shall establish, implement, maintain and continually improve a business continuity management system, including the processes needed and their interactions, in accordance with the requirements of this document.' },
      { clause_code: '5.1', title: 'Leadership and commitment', text: 'Top management shall demonstrate leadership and commitment with respect to the business continuity management system.' },
      { clause_code: '5.2', title: 'Policy', text: 'Top management shall establish a business continuity policy that is appropriate to the purpose of the organization.' },
      { clause_code: '5.3', title: 'Organizational roles, responsibilities and authorities', text: 'Top management shall ensure that the responsibilities and authorities for relevant roles are assigned, communicated and understood within the organization.' },
      { clause_code: '6.1', title: 'Actions to address risks and opportunities', text: 'When planning for the business continuity management system, the organization shall consider the issues referred to in 4.1 and the requirements referred to in 4.2 and determine the risks and opportunities that need to be addressed.' },
      { clause_code: '6.2', title: 'Business continuity objectives and planning to achieve them', text: 'The organization shall establish business continuity objectives at relevant functions, levels and processes needed for the business continuity management system.' },
      { clause_code: '8.1', title: 'Operational planning and control', text: 'The organization shall plan, implement and control the processes needed to meet business continuity requirements, and to implement the actions determined in clause 6.1.' },
      { clause_code: '8.2', title: 'Business impact analysis', text: 'The organization shall conduct a business impact analysis to determine the impact of disruption on its activities.' },
      { clause_code: '8.3', title: 'Risk assessment', text: 'The organization shall conduct a risk assessment to identify risks that could cause disruption to its activities.' },
      { clause_code: '8.4', title: 'Business continuity strategy', text: 'The organization shall determine and select business continuity strategies based on the results of the business impact analysis and risk assessment.' },
      { clause_code: '8.5', title: 'Business continuity procedures', text: 'The organization shall establish, implement and maintain business continuity procedures to manage an incident and activate the business continuity plans.' },
      { clause_code: '8.6', title: 'Exercising and testing', text: 'The organization shall exercise and test its business continuity procedures and business continuity plans to ensure that they are effective and up to date.' },
    ],
  },
  {
    code: 'PCI-DSS',
    name: 'Payment Card Industry Data Security Standard',
    version: '4.0',
    publisher: 'PCI SSC',
    clauses: [
      { clause_code: '1.1', title: 'Install and maintain network security controls', text: 'Network security controls (firewalls) are installed and maintained.' },
      { clause_code: '1.2', title: 'Network security controls are configured and maintained', text: 'Network security controls are configured and maintained in accordance with the entity\'s network security policy.' },
      { clause_code: '1.3', title: 'Network access to and from the cardholder data environment is restricted', text: 'Network access to and from the cardholder data environment is restricted.' },
      { clause_code: '2.1', title: 'Vendor default accounts and passwords are changed', text: 'Vendor default accounts and passwords are changed before first use.' },
      { clause_code: '2.2', title: 'Vendor default accounts and passwords are managed', text: 'Vendor default accounts and passwords are managed securely.' },
      { clause_code: '3.1', title: 'Cardholder data storage is minimized', text: 'Cardholder data storage is kept to a minimum.' },
      { clause_code: '3.2', title: 'Sensitive authentication data is not stored after authorization', text: 'Sensitive authentication data is not stored after authorization (even if encrypted).' },
      { clause_code: '4.1', title: 'Primary account numbers are protected with strong cryptography during transmission', text: 'Primary account numbers are protected with strong cryptography during transmission over open, public networks.' },
      { clause_code: '5.1', title: 'Anti-virus mechanisms are deployed', text: 'Anti-virus mechanisms are deployed on all system components commonly affected by malicious software.' },
      { clause_code: '5.2', title: 'Anti-virus mechanisms are kept current', text: 'Anti-virus mechanisms are kept current, perform periodic scans, and generate audit logs.' },
      { clause_code: '6.1', title: 'Security vulnerabilities are identified and addressed', text: 'Security vulnerabilities are identified and addressed.' },
      { clause_code: '6.2', title: 'Software and systems are protected from known vulnerabilities', text: 'Software and systems are protected from known vulnerabilities by installing applicable security updates.' },
      { clause_code: '7.1', title: 'Access to system components and cardholder data is restricted', text: 'Access to system components and cardholder data is restricted to only those individuals whose job requires such access.' },
      { clause_code: '7.2', title: 'Access rights are assigned and managed according to the access control policy', text: 'Access rights are assigned and managed according to the access control policy.' },
      { clause_code: '8.1', title: 'User identification and authentication are managed', text: 'User identification and authentication are managed via an authentication system.' },
      { clause_code: '8.2', title: 'Strong authentication is implemented for all system components', text: 'Strong authentication is implemented for all system components.' },
      { clause_code: '9.1', title: 'Physical access to system components is restricted', text: 'Physical access to system components is restricted.' },
      { clause_code: '10.1', title: 'Audit logs are implemented to link all access to system components', text: 'Audit logs are implemented to link all access to system components to each individual user.' },
      { clause_code: '11.1', title: 'Network security controls are tested', text: 'Network security controls are tested to ensure they are operating as intended.' },
      { clause_code: '12.1', title: 'A security policy is established, published, maintained, and disseminated', text: 'A security policy is established, published, maintained, and disseminated to all relevant personnel.' },
    ],
  },
];

async function run() {
  const { TenantEntity } = await import('../src/entities/tenant/tenant.entity');
  const { StandardEntity } = await import('../src/entities/app/standard.entity');
  const { StandardClauseEntity } = await import('../src/entities/app/standard-clause.entity');
  const entities = [TenantEntity, StandardEntity, StandardClauseEntity];

  const determineDataSourceOptions = (): DataSourceOptions => {
    const dbDriver = (process.env.DB_DRIVER || '').toLowerCase();
    const databaseUrl = process.env.DATABASE_URL;
    const preferPostgres = dbDriver === 'postgres' || !!databaseUrl;

    if (preferPostgres) {
      return {
        type: 'postgres',
        url: databaseUrl,
        host: databaseUrl ? undefined : process.env.DB_HOST || 'localhost',
        port: databaseUrl ? undefined : Number(process.env.DB_PORT || 5432),
        username: databaseUrl ? undefined : process.env.DB_USER || 'postgres',
        password: databaseUrl ? undefined : process.env.DB_PASS || 'postgres',
        database: databaseUrl ? undefined : process.env.DB_NAME || 'postgres',
        schema: process.env.DB_SCHEMA || 'public',
        logging: false,
        entities,
        synchronize: false,
        migrationsRun: false,
      };
    }

    const sqliteRelative = process.env.SQLITE_FILE || process.env.DB_NAME || 'data/grc.sqlite';
    const sqlitePath = path.isAbsolute(sqliteRelative)
      ? sqliteRelative
      : path.join(process.cwd(), sqliteRelative);
    fs.mkdirSync(path.dirname(sqlitePath), { recursive: true });

    return {
      type: 'sqlite',
      database: sqlitePath,
      logging: false,
      entities,
      synchronize: false, // Use migrations, not synchronize
    };
  };

  const ensureTenant = async (ds: DataSource) => {
    const tenantRepo = ds.getRepository(TenantEntity);
    let tenant = await tenantRepo.findOne({ where: { id: DEFAULT_TENANT_ID } });
    if (!tenant) {
      tenant = tenantRepo.create({
        id: DEFAULT_TENANT_ID,
        name: 'Default Tenant',
        slug: 'default',
        is_active: true,
      });
      tenant = await tenantRepo.save(tenant);
      console.log(`✅ Created tenant: ${tenant.id}`);
    } else {
      console.log(`✅ Tenant exists: ${tenant.id}`);
    }
    return tenant;
  };

  const ensureStandard = async (
    ds: DataSource,
    tenantId: string,
    standardData: typeof standards[0],
  ) => {
    const standardRepo = ds.getRepository(StandardEntity);
    
    // Use transaction for atomicity (prevents race conditions)
    const queryRunner = ds.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // Check if standard exists (within transaction)
      let standard = await queryRunner.manager.findOne(StandardEntity, {
        where: { code: standardData.code, tenant_id: tenantId },
      });

      if (standard) {
        // Update existing standard
        standard.name = standardData.name;
        standard.version = standardData.version;
        standard.publisher = standardData.publisher;
        standard = await queryRunner.manager.save(StandardEntity, standard);
        console.log(`✅ Updated standard: ${standardData.code}`);
      } else {
        // Create new standard
        standard = queryRunner.manager.create(StandardEntity, {
          id: randomUUID(),
          tenant_id: tenantId,
          code: standardData.code,
          name: standardData.name,
          version: standardData.version,
          publisher: standardData.publisher,
        });
        standard = await queryRunner.manager.save(StandardEntity, standard);
        console.log(`✅ Created standard: ${standardData.code}`);
      }

      // Create/update clauses (within same transaction)
      for (const clauseData of standardData.clauses) {
        // Check if clause exists (within transaction) - must check by standard_id + clause_code + tenant_id
        let clause = await queryRunner.manager.findOne(StandardClauseEntity, {
          where: {
            standard_id: standard.id,
            clause_code: clauseData.clause_code,
            tenant_id: tenantId,
          },
        });

        if (clause) {
          // Update existing clause
          clause.title = clauseData.title;
          clause.text = clauseData.text;
          clause = await queryRunner.manager.save(StandardClauseEntity, clause);
          console.log(`  ✅ Updated clause: ${standardData.code}:${clauseData.clause_code}`);
        } else {
          // Create new clause
          clause = queryRunner.manager.create(StandardClauseEntity, {
            id: randomUUID(),
            tenant_id: tenantId,
            standard_id: standard.id,
            clause_code: clauseData.clause_code,
            title: clauseData.title,
            text: clauseData.text,
            synthetic: false,
          });
          clause = await queryRunner.manager.save(StandardClauseEntity, clause);
          console.log(`  ✅ Created clause: ${standardData.code}:${clauseData.clause_code}`);
        }
      }

      // Commit transaction
      await queryRunner.commitTransaction();
      return standard;

    } catch (error: any) {
      // Rollback on error
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  };

  const options = determineDataSourceOptions();
  const dataSource = new DataSource(options);

  try {
    await dataSource.initialize();
    console.log('✅ Database connected');
    const tenant = await ensureTenant(dataSource);
    
    let successCount = 0;
    let errorCount = 0;
    
    for (const standardData of standards) {
      try {
        await ensureStandard(dataSource, tenant.id, standardData);
        successCount++;
      } catch (error: any) {
        errorCount++;
        console.error(`❌ Failed to seed standard ${standardData.code}:`, error?.message || error);
        // Continue with other standards even if one fails
      }
    }
    
    console.log(`\n✅ Standards seed completed: ${successCount} succeeded, ${errorCount} failed`);
    if (errorCount > 0) {
      console.error(`⚠️  Some standards failed to seed. Please check the errors above.`);
    }
  } catch (error) {
    console.error('❌ Standards seed failed', error);
    process.exitCode = 1;
  } finally {
    if (dataSource.isInitialized) {
      await dataSource.destroy();
    }
  }
}

run();

