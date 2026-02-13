# Solar Wallet Visualizer 🌌

An interactive 3D visualization tool that transforms blockchain wallet activity into a beautiful solar system interface. Built with Claude Code and powered by the GoldRush API.

Solar Wallet Visualizer
<img width="1456" height="815" alt="image" src="https://github.com/user-attachments/assets/72f55157-59f2-4558-b2c2-879343063692" />

## Overview

Solar Wallet Visualizer represents your Ethereum wallet as a sun at the center of a solar system, with orbiting planets representing wallets you've interacted with. Each orbital ring corresponds to a different blockchain network, creating an intuitive and visually stunning way to explore on-chain activity.

## Features

- **3D Solar System Interface**: Your wallet becomes the sun, with interacting wallets as orbiting planets
- **Multi-Chain Support**: Different orbital rings represent different blockchain networks (Fantom, Matic, Arbitrum, BSC, Avalanche, and more)
- **Interactive Exploration**: Click on planets to view wallet details and chain-specific information
- **Real-Time Data**: Powered by GoldRush API for accurate, up-to-date blockchain data
- **Portfolio Overview**: View total portfolio value, transaction count, and active chains
- **Activity Timeline**: Visualize wallet activity over time with an interactive timeline

## System Overview

The visualization displays:
- **Center (Sun)**: Your wallet address
- **Planets**: Wallets you've transacted with
- **Orbits**: Different blockchain networks
- **Planet Size**: Transaction volume or frequency
- **Colors**: Chain-specific color coding

## Statistics Displayed

- First Activity Date
- Total Portfolio Value
- Number of Orbiting Wallets
- Total Transactions
- Transaction Volume
- Active Chains

## Technology Stack

- **Frontend**: HTML5, CSS3, JavaScript
- **3D Graphics**: Three.js / Canvas API
- **Data Source**: [GoldRush API](https://goldrush.dev)
- **Development**: Claude Code

## Getting Started

### Prerequisites

- A GoldRush API key (get one at [goldrush.dev](https://goldrush.dev))
- Modern web browser with WebGL support
- Node.js (optional, for local development)

### Installation

1. Clone the repository:
```bash
git clone https://github.com/yourusername/solar-wallet-visualizer.git
cd solar-wallet-visualizer
```

2. Add your GoldRush API key:
```javascript
// In config.js or your main JavaScript file
const GOLDRUSH_API_KEY = 'your_api_key_here';
```

3. Open `index.html` in your browser or start a local server:
```bash
# Using Python
python -m http.server 8000

# Using Node.js
npx serve
```

4. Navigate to `localhost:8000` and enter a wallet address to visualize

## Usage

1. Enter an Ethereum wallet address (ENS names like `vitalik.eth` are supported)
2. Click "SCAN" to fetch and visualize the wallet data
3. Explore the solar system:
   - Rotate the view by dragging
   - Zoom in/out with scroll wheel
   - Click planets to view wallet details
   - Hover over chains in the legend for more info
4. Use the timeline scrubber to see activity over time

## Supported Chains

- Fantom (FTM)
- Polygon (MATIC)
- Arbitrum (ARB)
- Binance Smart Chain (BSC)
- Avalanche (AVAX)
- Ethereum (ETH)
- And more...

## API Integration

This project uses the GoldRush API (formerly Covalent) to fetch:
- Wallet transaction history
- Multi-chain portfolio data
- Token balances
- Transaction volumes
- Chain activity metrics

For API documentation, visit [GoldRush Docs](https://goldrush.dev/docs)

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Acknowledgments

- Built with [Claude Code](https://www.anthropic.com/claude)
- Powered by [GoldRush API](https://goldrush.dev)
- Inspired by the beauty of blockchain data
- Special thanks to the Web3 community

## Contact

Your Name - [@yourtwitter](https://twitter.com/yourtwitter)

Project Link: [https://github.com/yourusername/solar-wallet-visualizer](https://github.com/yourusername/solar-wallet-visualizer)

---

⭐ If you find this project interesting, please consider giving it a star!

Built with ❤️ and Claude Code + GoldRush API



