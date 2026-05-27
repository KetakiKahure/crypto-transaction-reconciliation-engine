const typeMap = {
  BUY: "BUY",
  SELL: "SELL",

  TRANSFER: "TRANSFER",

  TRANSFER_IN: "TRANSFER_IN",
  TRANSFER_OUT: "TRANSFER_OUT",
};

function normalizeType(type) {
  if (!type) return null;

  return (
    typeMap[type.toUpperCase().trim()] ||
    type.toUpperCase().trim()
  );
}

export default normalizeType;