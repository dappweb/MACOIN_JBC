# Technology Stack

## Frontend Stack

- **Framework**: React 19 with TypeScript
- **Build Tool**: Vite 4.5.14
- **Styling**: Tailwind CSS (inferred from components)
- **Web3 Integration**: 
  - Wagmi 2.19.5 for Ethereum interactions
  - RainbowKit 2.2.10 for wallet connections
  - Ethers.js 6.8.0 for contract interactions
- **State Management**: React Query (@tanstack/react-query 5.90.12)
- **UI Components**: Lucide React icons, React Hot Toast for notifications
- **Charts**: Recharts 3.5.1

## Smart Contract Stack

- **Framework**: Hardhat 2.27.0
- **Solidity**: 0.8.20 and 0.8.22 with optimizer enabled
- **Libraries**: 
  - OpenZeppelin Contracts 5.4.0 (standard and upgradeable)
  - OpenZeppelin Hardhat Upgrades 3.9.1
- **Testing**: Hardhat Toolbox with Chai matchers
- **Deployment**: UUPS upgradeable proxy pattern

## Infrastructure

- **Hosting**: Cloudflare Pages
- **Functions**: Cloudflare Workers/Functions for API endpoints
- **Automation**: GitHub Actions for CI/CD and scheduled tasks
- **Environment**: Node.js 18+ required

## Common Commands

### Development
```bash
# Start frontend development server
npm run dev

# Build frontend application
npm run build

# Preview production build
npm run preview
```

### Smart Contracts
```bash
# Compile contracts
npm run compile

# Run contract tests
npm run test:contracts

# Deploy to MC Chain
npm run deploy:mc

# Deploy to other networks
npm run deploy:sepolia
npm run deploy:bsc
```

### Testing
```bash
# Run all tests
npm run test:all

# Frontend tests with Vitest
npm run test:ui

# Contract coverage
npm run test:coverage

# Gas reporting
npm run test:gas
```

### Cloudflare Deployment
```bash
# Local development with Functions
npm run pages:dev

# Deploy to Cloudflare Pages
npm run pages:deploy

# Test burn API locally
npm run burn:test

# Check burn status
npm run burn:status
```

## Configuration Notes

- Uses custom MC Chain (88813) as primary network
- Hardhat config located in `config/hardhat.config.cjs`
- Vite config supports crypto polyfills for Web3 compatibility
- Environment variables required: `PRIVATE_KEY`, `GEMINI_API_KEY`
- TypeScript with strict settings and path aliases (`@/*`)