function text(value, max) {
  return typeof value === "string" && value.trim().length > 0 && value.trim().length <= max;
}
function email(value) {
  return text(value, 254) && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}
function password(value, min = 8) {
  // bcrypt silently ignores bytes past 72; reject them instead.
  return typeof value === "string" && value.length >= min && Buffer.byteLength(value, "utf8") <= 72;
}
function id(value) {
  return (typeof value === "number" || typeof value === "string") && /^[1-9]\d*$/.test(String(value)) && Number.isSafeInteger(Number(value));
}
module.exports = { text, email, password, id };
