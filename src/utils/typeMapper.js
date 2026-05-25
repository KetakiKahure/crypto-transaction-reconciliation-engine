const typeMap = {
  BUY: "BUY",
  SELL: "SELL",

  TRANSFER: "TRANSFER",

  TRANSFER_IN: "TRANSFER",
  TRANSFER_OUT: "TRANSFER",
};

function normalizeType(type) {
  if (!type) return null;

  return (
    typeMap[type.toUpperCase().trim()] ||
    type.toUpperCase().trim()
  );
}

export default normalizeType;