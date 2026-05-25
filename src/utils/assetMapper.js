const assetAliasMap = {
  BITCOIN: "BTC",
  XBT: "BTC",
  ETHEREUM: "ETH",
  TETHER: "USDT",
  SOLANA: "SOL",
  POLYGON: "MATIC",
  CHAINLINK: "LINK",
  USD: "USD",
  USDT: "USDT",
  BTC: "BTC",
  ETH: "ETH",
  SOL: "SOL",
  MATIC: "MATIC",
  LINK: "LINK",
};

function normalizeAsset(asset) {
  if (!asset) return null;

  const normalized = asset
    .toString()
    .trim()
    .replace(/[\s_\/-]+/g, "")
    .toUpperCase();

  return assetAliasMap[normalized] || normalized;
}

export default normalizeAsset;