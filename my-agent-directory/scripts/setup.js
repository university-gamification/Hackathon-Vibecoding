#!/usr/bin/env node

import { createDatabaseClient, createProject, getProject } from '@inkeep/agents-core';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const dbUrl = process.env.DB_FILE_NAME || 'file:local.db';
const tenantId = 'default';
const projectId = 'default';
const projectName = 'default';
const projectDescription = 'Generated Inkeep Agents project';

async function setupProject() {
  console.log('🚀 Setting up your Inkeep Agents project...');
  
  try {
    const dbClient = createDatabaseClient({ url: dbUrl });
    
    // Check if project already exists
    console.log('📋 Checking if project already exists...');
    try {
      const existingProject = await getProject(dbClient)({ 
        id: projectId, 
        tenantId: tenantId 
      });
      
      if (existingProject) {
        console.log('✅ Project already exists in database:', existingProject.name);
        console.log('🎯 Project ID:', projectId);
        console.log('🏢 Tenant ID:', tenantId);
        return;
      }
    } catch (error) {
      // Only ignore known "not found" cases; surface other errors
      const msg = String(error?.message || '').toLowerCase();
      const code = (error && (error.code || error.status || error.name)) || '';
      const isNotFound = msg.includes('not found') || msg.includes("doesn't exist") || String(code).toLowerCase() === 'not_found';
      if (!isNotFound) {
        console.error('❌ Unexpected error while checking project existence:', error);
        throw error;
      }
      // Continue with creation
    }
    
    // Create the project in the database
    console.log('📦 Creating project in database...');
    // Build models configuration from environment or use defaults
    let modelsConfig;
    try {
      modelsConfig = process.env.MODELS_CONFIG ? JSON.parse(process.env.MODELS_CONFIG) : undefined;
    } catch (e) {
      console.warn('⚠️ Failed to parse MODELS_CONFIG; falling back to defaults:', e);
    }
    if (!modelsConfig || typeof modelsConfig !== 'object') {
      modelsConfig = {
        base: { model: 'anthropic/claude-sonnet-4-0' },
        structuredOutput: { model: 'openai/gpt-4.1-mini' },
        summarizer: { model: 'openai/gpt-4.1-nano' },
      };
    }

    await createProject(dbClient)({
      id: projectId,
      tenantId: tenantId,
      name: projectName,
      description: projectDescription,
      models: modelsConfig,
    });
    
    console.log('✅ Project created successfully!');
    console.log('🎯 Project ID:', projectId);
    console.log('🏢 Tenant ID:', tenantId);
    console.log('');
    console.log('🎉 Setup complete! Your development servers are running.');
    console.log('');
    console.log('📋 Available URLs:');
    console.log('   - Management UI: http://localhost:3002');
    console.log('   - Runtime API:   http://localhost:3003');
    console.log('');
    console.log('🚀 Ready to build agents!');
    
  } catch (error) {
    console.error('❌ Failed to setup project:', error);
    process.exit(1);
  }
}

setupProject();
