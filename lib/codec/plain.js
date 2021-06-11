'use strict';
const INT53 = require('int53');

function encodeValues_BOOLEAN(values) {
  let buf = Buffer.alloc(Math.ceil(values.length / 8));
  buf.fill(0);

  for (let i = 0; i < values.length; ++i) {
    if (values[i]) {
      buf[Math.floor(i / 8)] |= (1 << (i % 8));
    }
  }

  return buf;
}

function decodeValues_BOOLEAN(cursor, count) {
  let values = [];

  for (let i = 0; i < count; ++i) {
    let b = cursor.buffer[cursor.offset + Math.floor(i / 8)];
    values.push((b & (1 << (i % 8))) > 0);
  }

  cursor.offset += Math.ceil(count / 8);
  return values;
}

function encodeValues_INT32(values) {
  let buf = Buffer.alloc(4 * values.length);
  for (let i = 0; i < values.length; i++) {
    buf.writeInt32LE(values[i], i * 4)
  }

  return buf;
}

function decodeValues_INT32(cursor, count) {
  let values = [];

  for (let i = 0; i < count; ++i) {
    values.push(cursor.buffer.readInt32LE(cursor.offset));
    cursor.offset += 4;
  }

  return values;
}

function encodeValues_INT64(values) {
  let buf = Buffer.alloc(8 * values.length);
  for (let i = 0; i < values.length; i++) {
    //console.log(typeof values[i]);
    buf.writeBigInt64LE(BigInt(values[i]), i*8);
  }

  return buf;
}

function decodeValues_INT64(cursor, count) {
  let values = [];

  for (let i = 0; i < count; ++i) {
    values.push(cursor.buffer.readBigInt64LE(cursor.offset));
    cursor.offset += 8;
  }

  return values;
}

function encodeValues_INT96(values) {
  let buf = Buffer.alloc(12 * values.length);

  for (let i = 0; i < values.length; i++) {
    if (values[i] >= 0) {
      INT53.writeInt64LE(values[i], buf, i * 12);
      buf.writeUInt32LE(0, i * 12 + 8); // truncate to 64 actual precision
    } else {
      INT53.writeInt64LE((~-values[i]) + 1, buf, i * 12);
      buf.writeUInt32LE(0xffffffff, i * 12 + 8); // truncate to 64 actual precision
    }
  }

  return buf;
}

/**
 * Copied from https://stackoverflow.com/questions/26370688/convert-a-julian-date-to-regular-date-in-javascript/36073807
 * @param {number} JD
 * @returns {Date}
 */
function julianIntToDate(JD) {
  var y = 4716;
  var v = 3;
  var j = 1401;
  var u = 5;
  var m = 2;
  var s = 153;
  var n = 12;
  var w = 2;
  var r = 4;
  var B = 274277;
  var p = 1461;
  var C = -38;
  var f = JD + j + Math.floor((Math.floor((4 * JD + B) / 146097) * 3) / 4) + C;
  var e = r * f + v;
  var g = Math.floor((e % p) / r);
  var h = u * g + w;
  var D = Math.floor((h % s) / u) + 1;
  var M = ((Math.floor(h / s) + m) % n) + 1;
  var Y = Math.floor(e / p) - y + Math.floor((n + m - M) / n);
  return new Date(Y, M - 1, D);
}

function decodeValues_INT96(cursor, count) {
  let values = [];

  for(let i = 0; i < count; ++i) {
    const nano = INT53.readInt64LE(cursor.buffer, cursor.offset);
    const dt = cursor.buffer.readUInt32LE(cursor.offset + 8);

    let seconds = Math.round(nano / (1000 * 1000 * 1000));

    let date = julianIntToDate(dt);
    date.setHours(Math.floor(seconds / 3600));
    date.setMinutes(Math.floor(seconds % 3600 / 60));
    date.setSeconds(seconds % 60);
    values.push(date);

    cursor.offset += 12;
  }

  return values;
}


function encodeValues_FLOAT(values) {
  let buf = Buffer.alloc(4 * values.length);
  for (let i = 0; i < values.length; i++) {
    buf.writeFloatLE(values[i], i * 4)
  }

  return buf;
}

function decodeValues_FLOAT(cursor, count) {
  let values = [];

  for (let i = 0; i < count; ++i) {
    values.push(cursor.buffer.readFloatLE(cursor.offset));
    cursor.offset += 4;
  }

  return values;
}

function encodeValues_DOUBLE(values) {
  let buf = Buffer.alloc(8 * values.length);
  for (let i = 0; i < values.length; i++) {
    buf.writeDoubleLE(values[i], i * 8)
  }

  return buf;
}

function decodeValues_DOUBLE(cursor, count) {
  let values = [];

  for (let i = 0; i < count; ++i) {
    values.push(cursor.buffer.readDoubleLE(cursor.offset));
    cursor.offset += 8;
  }

  return values;
}

function encodeValues_BYTE_ARRAY(values) {
  let buf_len = 0;
  for (let i = 0; i < values.length; i++) {
    values[i] = Buffer.from(values[i]);
    buf_len += 4 + values[i].length;
  }

  let buf = Buffer.alloc(buf_len);
  let buf_pos = 0;
  for (let i = 0; i < values.length; i++) {
    buf.writeUInt32LE(values[i].length, buf_pos)
    values[i].copy(buf, buf_pos + 4);
    buf_pos += 4 + values[i].length;

  }

  return buf;
}

function decodeValues_BYTE_ARRAY(cursor, count) {
  let values = [];

  for (let i = 0; i < count; ++i) {
    let len = cursor.buffer.readUInt32LE(cursor.offset);
    cursor.offset += 4;
    values.push(cursor.buffer.slice(cursor.offset, cursor.offset + len));
    cursor.offset += len;
  }

  return values;
}



function encodeValues_FIXED_LEN_BYTE_ARRAY(values, opts) {
  if (!opts.typeLength) {
    throw "missing option: typeLength (required for FIXED_LEN_BYTE_ARRAY)";
  }

  let buf_len = 0;
  for (let i = 0; i < values.length; i++) {
    values[i] = Buffer.from(values[i]);

    if (values[i].length !== opts.typeLength) {
      throw "invalid value for FIXED_LEN_BYTE_ARRAY: " + values[i];
    }
  }

  return Buffer.concat(values);
}

function decodeValues_FIXED_LEN_BYTE_ARRAY(cursor, count, opts) {
  let values = [];

  if (!opts.typeLength) {
    throw "missing option: typeLength (required for FIXED_LEN_BYTE_ARRAY)";
  }

  for (let i = 0; i < count; ++i) {
    values.push(cursor.buffer.slice(cursor.offset, cursor.offset + opts.typeLength));
    cursor.offset += opts.typeLength;
  }

  return values;
}

exports.encodeValues = function(type, values, opts) {
  switch (type) {

    case 'BOOLEAN':
      return encodeValues_BOOLEAN(values);

    case 'INT32':
      return encodeValues_INT32(values);

    case 'INT64':
      return encodeValues_INT64(values);

    case 'INT96':
      return encodeValues_INT96(values);

    case 'FLOAT':
      return encodeValues_FLOAT(values);

    case 'DOUBLE':
      return encodeValues_DOUBLE(values);

    case 'BYTE_ARRAY':
      return encodeValues_BYTE_ARRAY(values);

    case 'FIXED_LEN_BYTE_ARRAY':
      return encodeValues_FIXED_LEN_BYTE_ARRAY(values, opts);

    default:
      throw 'unsupported type: ' + type;

  }
}

exports.decodeValues = function(type, cursor, count, opts) {
  switch (type) {

    case 'BOOLEAN':
      return decodeValues_BOOLEAN(cursor, count);

    case 'INT32':
      return decodeValues_INT32(cursor, count);

    case 'INT64':
      return decodeValues_INT64(cursor, count);

    case 'INT96':
      return decodeValues_INT96(cursor, count);

    case 'FLOAT':
      return decodeValues_FLOAT(cursor, count);

    case 'DOUBLE':
      return decodeValues_DOUBLE(cursor, count);

    case 'BYTE_ARRAY':
      return decodeValues_BYTE_ARRAY(cursor, count);

    case 'FIXED_LEN_BYTE_ARRAY':
      return decodeValues_FIXED_LEN_BYTE_ARRAY(cursor, count, opts);

    default:
      throw 'unsupported type: ' + type;

  }
}

