#!/bin/bash

# AWS Parameter Store Fetch Script for PantherKolab
# This script retrieves parameters from AWS Systems Manager Parameter Store
# and optionally creates a .env.local file

set -e

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${BLUE}============================================${NC}"
echo -e "${BLUE}  PantherKolab Parameter Fetch${NC}"
echo -e "${BLUE}============================================${NC}"
echo ""

# Set the AWS region
read -p "AWS Region [default: us-east-1]: " AWS_REGION
AWS_REGION="${AWS_REGION:-us-east-1}"
echo -e "${YELLOW}Using AWS Region: ${AWS_REGION}${NC}"
echo ""

# Parameter prefix
PREFIX="/panther-kolab"
read -p "Environment (dev/staging/prod) [default: dev]: " ENVIRONMENT
ENVIRONMENT="${ENVIRONMENT:-dev}"
FULL_PREFIX="${PREFIX}/${ENVIRONMENT}"

echo -e "${YELLOW}Fetching parameters from: ${FULL_PREFIX}${NC}"
echo ""

# Fetch all parameters
echo -e "${BLUE}Retrieving parameters...${NC}"
parameters=$(aws ssm get-parameters-by-path \
    --path "${FULL_PREFIX}" \
    --recursive \
    --with-decryption \
    --region "${AWS_REGION}" \
    --query 'Parameters[*].[Name,Value]' \
    --output text 2>/dev/null)

if [ -z "$parameters" ]; then
    echo -e "${RED}No parameters found at path: ${FULL_PREFIX}${NC}"
    echo -e "${YELLOW}Have you run setup-parameter-store.sh yet?${NC}"
    exit 1
fi

# Display parameters
echo -e "${GREEN}Found parameters:${NC}"
echo ""

# Count parameters
param_count=$(echo "$parameters" | wc -l)

# Display each parameter
while IFS=$'\t' read -r name value; do
    # Remove prefix to show relative path
    relative_name=${name#"${FULL_PREFIX}/"}

    # Mask sensitive values (those containing 'key', 'secret', 'password', 'token')
    if [[ "$relative_name" =~ (key|secret|password|token) ]]; then
        display_value="********"
    else
        display_value="$value"
    fi

    echo -e "  ${BLUE}${relative_name}${NC} = ${display_value}"
done <<< "$parameters"

echo ""
echo -e "${GREEN}Total parameters: ${param_count}${NC}"
echo ""

# Ask if user wants to create .env.local file
read -p "Create/update .env.local file? (y/N): " create_env

if [ "$create_env" = "y" ] || [ "$create_env" = "Y" ]; then
    ENV_FILE=".env.local"

    echo -e "${BLUE}Creating ${ENV_FILE}...${NC}"

    # Create .env.local with header
    cat > "$ENV_FILE" << EOF
# PantherKolab Environment Variables
# Auto-generated from AWS Parameter Store
# Generated: $(date)
# Environment: ${ENVIRONMENT}
# DO NOT COMMIT THIS FILE TO VERSION CONTROL

EOF

    # Process parameters and convert to env format
    while IFS=$'\t' read -r name value; do
        # Remove prefix to get relative path
        relative_name=${name#"${FULL_PREFIX}/"}

        # Convert path to env variable name
        # Replace slashes with underscores and convert to uppercase
        env_var_name=$(echo "$relative_name" | tr '/' '_' | tr '[:lower:]' '[:upper:]' | tr '-' '_')

        # Add NEXT_PUBLIC prefix if it's a client-side variable
        if [[ "$relative_name" =~ ^(cognito|dynamodb|app-urls|appsync)/ ]]; then
            env_var_name="NEXT_PUBLIC_${env_var_name}"
        fi

        # Write to .env.local
        echo "${env_var_name}=${value}" >> "$ENV_FILE"
    done <<< "$parameters"

    echo -e "${GREEN}✓ Created ${ENV_FILE}${NC}"
    echo ""
    echo -e "${YELLOW}Note: Make sure ${ENV_FILE} is in your .gitignore${NC}"
else
    echo -e "${YELLOW}Skipping .env.local creation${NC}"
fi

echo ""
echo -e "${GREEN}============================================${NC}"
echo -e "${GREEN}  ✓ Fetch complete!${NC}"
echo -e "${GREEN}============================================${NC}"
echo ""