(() => {
  // .care-v3-map/kit/node_modules/fflate/esm/browser.js
  var u8 = Uint8Array;
  var u16 = Uint16Array;
  var i32 = Int32Array;
  var fleb = new u8([
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    1,
    1,
    1,
    1,
    2,
    2,
    2,
    2,
    3,
    3,
    3,
    3,
    4,
    4,
    4,
    4,
    5,
    5,
    5,
    5,
    0,
    /* unused */
    0,
    0,
    /* impossible */
    0
  ]);
  var fdeb = new u8([
    0,
    0,
    0,
    0,
    1,
    1,
    2,
    2,
    3,
    3,
    4,
    4,
    5,
    5,
    6,
    6,
    7,
    7,
    8,
    8,
    9,
    9,
    10,
    10,
    11,
    11,
    12,
    12,
    13,
    13,
    /* unused */
    0,
    0
  ]);
  var clim = new u8([16, 17, 18, 0, 8, 7, 9, 6, 10, 5, 11, 4, 12, 3, 13, 2, 14, 1, 15]);
  var freb = function(eb, start) {
    var b = new u16(31);
    for (var i = 0; i < 31; ++i) {
      b[i] = start += 1 << eb[i - 1];
    }
    var r = new i32(b[30]);
    for (var i = 1; i < 30; ++i) {
      for (var j = b[i]; j < b[i + 1]; ++j) {
        r[j] = j - b[i] << 5 | i;
      }
    }
    return { b, r };
  };
  var _a = freb(fleb, 2);
  var fl = _a.b;
  var revfl = _a.r;
  fl[28] = 258, revfl[258] = 28;
  var _b = freb(fdeb, 0);
  var fd = _b.b;
  var revfd = _b.r;
  var rev = new u16(32768);
  for (i = 0; i < 32768; ++i) {
    x = (i & 43690) >> 1 | (i & 21845) << 1;
    x = (x & 52428) >> 2 | (x & 13107) << 2;
    x = (x & 61680) >> 4 | (x & 3855) << 4;
    rev[i] = ((x & 65280) >> 8 | (x & 255) << 8) >> 1;
  }
  var x;
  var i;
  var hMap = (function(cd, mb, r) {
    var s = cd.length;
    var i = 0;
    var l = new u16(mb);
    for (; i < s; ++i) {
      if (cd[i])
        ++l[cd[i] - 1];
    }
    var le = new u16(mb);
    for (i = 1; i < mb; ++i) {
      le[i] = le[i - 1] + l[i - 1] << 1;
    }
    var co;
    if (r) {
      co = new u16(1 << mb);
      var rvb = 15 - mb;
      for (i = 0; i < s; ++i) {
        if (cd[i]) {
          var sv = i << 4 | cd[i];
          var r_1 = mb - cd[i];
          var v = le[cd[i] - 1]++ << r_1;
          for (var m = v | (1 << r_1) - 1; v <= m; ++v) {
            co[rev[v] >> rvb] = sv;
          }
        }
      }
    } else {
      co = new u16(s);
      for (i = 0; i < s; ++i) {
        if (cd[i]) {
          co[i] = rev[le[cd[i] - 1]++] >> 15 - cd[i];
        }
      }
    }
    return co;
  });
  var flt = new u8(288);
  for (i = 0; i < 144; ++i)
    flt[i] = 8;
  var i;
  for (i = 144; i < 256; ++i)
    flt[i] = 9;
  var i;
  for (i = 256; i < 280; ++i)
    flt[i] = 7;
  var i;
  for (i = 280; i < 288; ++i)
    flt[i] = 8;
  var i;
  var fdt = new u8(32);
  for (i = 0; i < 32; ++i)
    fdt[i] = 5;
  var i;
  var flrm = /* @__PURE__ */ hMap(flt, 9, 1);
  var fdrm = /* @__PURE__ */ hMap(fdt, 5, 1);
  var max = function(a) {
    var m = a[0];
    for (var i = 1; i < a.length; ++i) {
      if (a[i] > m)
        m = a[i];
    }
    return m;
  };
  var bits = function(d, p, m) {
    var o = p / 8 | 0;
    return (d[o] | d[o + 1] << 8) >> (p & 7) & m;
  };
  var bits16 = function(d, p) {
    var o = p / 8 | 0;
    return (d[o] | d[o + 1] << 8 | d[o + 2] << 16) >> (p & 7);
  };
  var shft = function(p) {
    return (p + 7) / 8 | 0;
  };
  var slc = function(v, s, e) {
    if (s == null || s < 0)
      s = 0;
    if (e == null || e > v.length)
      e = v.length;
    return new u8(v.subarray(s, e));
  };
  var ec = [
    "unexpected EOF",
    "invalid block type",
    "invalid length/literal",
    "invalid distance",
    "stream finished",
    "no stream handler",
    ,
    "no callback",
    "invalid UTF-8 data",
    "extra field too long",
    "date not in range 1980-2099",
    "filename too long",
    "stream finishing",
    "invalid zip data"
    // determined by unknown compression method
  ];
  var err = function(ind, msg, nt) {
    var e = new Error(msg || ec[ind]);
    e.code = ind;
    if (Error.captureStackTrace)
      Error.captureStackTrace(e, err);
    if (!nt)
      throw e;
    return e;
  };
  var inflt = function(dat, st, buf, dict) {
    var sl = dat.length, dl = dict ? dict.length : 0;
    if (!sl || st.f && !st.l)
      return buf || new u8(0);
    var noBuf = !buf;
    var resize = noBuf || st.i != 2;
    var noSt = st.i;
    if (noBuf)
      buf = new u8(sl * 3);
    var cbuf = function(l2) {
      var bl = buf.length;
      if (l2 > bl) {
        var nbuf = new u8(Math.max(bl * 2, l2));
        nbuf.set(buf);
        buf = nbuf;
      }
    };
    var final = st.f || 0, pos = st.p || 0, bt = st.b || 0, lm = st.l, dm = st.d, lbt = st.m, dbt = st.n;
    var tbts = sl * 8;
    do {
      if (!lm) {
        final = bits(dat, pos, 1);
        var type = bits(dat, pos + 1, 3);
        pos += 3;
        if (!type) {
          var s = shft(pos) + 4, l = dat[s - 4] | dat[s - 3] << 8, t = s + l;
          if (t > sl) {
            if (noSt)
              err(0);
            break;
          }
          if (resize)
            cbuf(bt + l);
          buf.set(dat.subarray(s, t), bt);
          st.b = bt += l, st.p = pos = t * 8, st.f = final;
          continue;
        } else if (type == 1)
          lm = flrm, dm = fdrm, lbt = 9, dbt = 5;
        else if (type == 2) {
          var hLit = bits(dat, pos, 31) + 257, hcLen = bits(dat, pos + 10, 15) + 4;
          var tl = hLit + bits(dat, pos + 5, 31) + 1;
          pos += 14;
          var ldt = new u8(tl);
          var clt = new u8(19);
          for (var i = 0; i < hcLen; ++i) {
            clt[clim[i]] = bits(dat, pos + i * 3, 7);
          }
          pos += hcLen * 3;
          var clb = max(clt), clbmsk = (1 << clb) - 1;
          var clm = hMap(clt, clb, 1);
          for (var i = 0; i < tl; ) {
            var r = clm[bits(dat, pos, clbmsk)];
            pos += r & 15;
            var s = r >> 4;
            if (s < 16) {
              ldt[i++] = s;
            } else {
              var c = 0, n = 0;
              if (s == 16)
                n = 3 + bits(dat, pos, 3), pos += 2, c = ldt[i - 1];
              else if (s == 17)
                n = 3 + bits(dat, pos, 7), pos += 3;
              else if (s == 18)
                n = 11 + bits(dat, pos, 127), pos += 7;
              while (n--)
                ldt[i++] = c;
            }
          }
          var lt = ldt.subarray(0, hLit), dt = ldt.subarray(hLit);
          lbt = max(lt);
          dbt = max(dt);
          lm = hMap(lt, lbt, 1);
          dm = hMap(dt, dbt, 1);
        } else
          err(1);
        if (pos > tbts) {
          if (noSt)
            err(0);
          break;
        }
      }
      if (resize)
        cbuf(bt + 131072);
      var lms = (1 << lbt) - 1, dms = (1 << dbt) - 1;
      var lpos = pos;
      for (; ; lpos = pos) {
        var c = lm[bits16(dat, pos) & lms], sym = c >> 4;
        pos += c & 15;
        if (pos > tbts) {
          if (noSt)
            err(0);
          break;
        }
        if (!c)
          err(2);
        if (sym < 256)
          buf[bt++] = sym;
        else if (sym == 256) {
          lpos = pos, lm = null;
          break;
        } else {
          var add = sym - 254;
          if (sym > 264) {
            var i = sym - 257, b = fleb[i];
            add = bits(dat, pos, (1 << b) - 1) + fl[i];
            pos += b;
          }
          var d = dm[bits16(dat, pos) & dms], dsym = d >> 4;
          if (!d)
            err(3);
          pos += d & 15;
          var dt = fd[dsym];
          if (dsym > 3) {
            var b = fdeb[dsym];
            dt += bits16(dat, pos) & (1 << b) - 1, pos += b;
          }
          if (pos > tbts) {
            if (noSt)
              err(0);
            break;
          }
          if (resize)
            cbuf(bt + 131072);
          var end = bt + add;
          if (bt < dt) {
            var shift = dl - dt, dend = Math.min(dt, end);
            if (shift + bt < 0)
              err(3);
            for (; bt < dend; ++bt)
              buf[bt] = dict[shift + bt];
          }
          for (; bt < end; ++bt)
            buf[bt] = buf[bt - dt];
        }
      }
      st.l = lm, st.p = lpos, st.b = bt, st.f = final;
      if (lm)
        final = 1, st.m = lbt, st.d = dm, st.n = dbt;
    } while (!final);
    return bt != buf.length && noBuf ? slc(buf, 0, bt) : buf.subarray(0, bt);
  };
  var et = /* @__PURE__ */ new u8(0);
  var gzs = function(d) {
    if (d[0] != 31 || d[1] != 139 || d[2] != 8)
      err(6, "invalid gzip data");
    var flg = d[3];
    var st = 10;
    if (flg & 4)
      st += (d[10] | d[11] << 8) + 2;
    for (var zs = (flg >> 3 & 1) + (flg >> 4 & 1); zs > 0; zs -= !d[st++])
      ;
    return st + (flg & 2);
  };
  var gzl = function(d) {
    var l = d.length;
    return (d[l - 4] | d[l - 3] << 8 | d[l - 2] << 16 | d[l - 1] << 24) >>> 0;
  };
  function gunzipSync(data, opts) {
    var st = gzs(data);
    if (st + 8 > data.length)
      err(6, "invalid gzip data");
    return inflt(data.subarray(st, -8), { i: 2 }, opts && opts.out || new u8(gzl(data)), opts && opts.dictionary);
  }
  var td = typeof TextDecoder != "undefined" && /* @__PURE__ */ new TextDecoder();
  var tds = 0;
  try {
    td.decode(et, { stream: true });
    tds = 1;
  } catch (e) {
  }
  var dutf8 = function(d) {
    for (var r = "", i = 0; ; ) {
      var c = d[i++];
      var eb = (c > 127) + (c > 223) + (c > 239);
      if (i + eb > d.length)
        return { s: r, r: slc(d, i - 1) };
      if (!eb)
        r += String.fromCharCode(c);
      else if (eb == 3) {
        c = ((c & 15) << 18 | (d[i++] & 63) << 12 | (d[i++] & 63) << 6 | d[i++] & 63) - 65536, r += String.fromCharCode(55296 | c >> 10, 56320 | c & 1023);
      } else if (eb & 1)
        r += String.fromCharCode((c & 31) << 6 | d[i++] & 63);
      else
        r += String.fromCharCode((c & 15) << 12 | (d[i++] & 63) << 6 | d[i++] & 63);
    }
  };
  function strFromU8(dat, latin1) {
    if (latin1) {
      var r = "";
      for (var i = 0; i < dat.length; i += 16384)
        r += String.fromCharCode.apply(null, dat.subarray(i, i + 16384));
      return r;
    } else if (td) {
      return td.decode(dat);
    } else {
      var _a2 = dutf8(dat), s = _a2.s, r = _a2.r;
      if (r.length)
        err(8);
      return s;
    }
  }

  // .care-v3-map/kit/node_modules/pbf/index.js
  var SHIFT_LEFT_32 = (1 << 16) * (1 << 16);
  var SHIFT_RIGHT_32 = 1 / SHIFT_LEFT_32;
  var TEXT_DECODER_MIN_LENGTH = 12;
  var utf8TextDecoder = typeof TextDecoder === "undefined" ? null : new TextDecoder("utf-8");
  var PBF_VARINT = 0;
  var PBF_FIXED64 = 1;
  var PBF_BYTES = 2;
  var PBF_FIXED32 = 5;
  var Pbf = class {
    /**
     * @param {Uint8Array | ArrayBuffer} [buf]
     */
    constructor(buf = new Uint8Array(16)) {
      this.buf = ArrayBuffer.isView(buf) ? buf : new Uint8Array(buf);
      this.dataView = new DataView(this.buf.buffer);
      this.pos = 0;
      this.type = 0;
      this.length = this.buf.length;
    }
    // === READING =================================================================
    /**
     * @template T
     * @param {(tag: number, result: T, pbf: Pbf) => void} readField
     * @param {T} result
     * @param {number} [end]
     */
    readFields(readField, result, end = this.length) {
      while (this.pos < end) {
        const val = this.readVarint(), tag = val >> 3, startPos = this.pos;
        this.type = val & 7;
        readField(tag, result, this);
        if (this.pos === startPos) this.skip(val);
      }
      return result;
    }
    /**
     * @template T
     * @param {(tag: number, result: T, pbf: Pbf) => void} readField
     * @param {T} result
     */
    readMessage(readField, result) {
      return this.readFields(readField, result, this.readVarint() + this.pos);
    }
    readFixed32() {
      const val = this.dataView.getUint32(this.pos, true);
      this.pos += 4;
      return val;
    }
    readSFixed32() {
      const val = this.dataView.getInt32(this.pos, true);
      this.pos += 4;
      return val;
    }
    // 64-bit int handling is based on github.com/dpw/node-buffer-more-ints (MIT-licensed)
    readFixed64() {
      const val = this.dataView.getUint32(this.pos, true) + this.dataView.getUint32(this.pos + 4, true) * SHIFT_LEFT_32;
      this.pos += 8;
      return val;
    }
    readSFixed64() {
      const val = this.dataView.getUint32(this.pos, true) + this.dataView.getInt32(this.pos + 4, true) * SHIFT_LEFT_32;
      this.pos += 8;
      return val;
    }
    readFloat() {
      const val = this.dataView.getFloat32(this.pos, true);
      this.pos += 4;
      return val;
    }
    readDouble() {
      const val = this.dataView.getFloat64(this.pos, true);
      this.pos += 8;
      return val;
    }
    /**
     * @param {boolean} [isSigned]
     */
    readVarint(isSigned) {
      const buf = this.buf;
      let val, b;
      b = buf[this.pos++];
      val = b & 127;
      if (b < 128) return val;
      b = buf[this.pos++];
      val |= (b & 127) << 7;
      if (b < 128) return val;
      b = buf[this.pos++];
      val |= (b & 127) << 14;
      if (b < 128) return val;
      b = buf[this.pos++];
      val |= (b & 127) << 21;
      if (b < 128) return val;
      b = buf[this.pos];
      val |= (b & 15) << 28;
      return readVarintRemainder(val, isSigned, this);
    }
    readVarint64() {
      return this.readVarint(true);
    }
    readSVarint() {
      const num = this.readVarint();
      return num % 2 === 1 ? (num + 1) / -2 : num / 2;
    }
    readBoolean() {
      return Boolean(this.readVarint());
    }
    readString() {
      const end = this.readVarint() + this.pos;
      const pos = this.pos;
      this.pos = end;
      if (end - pos >= TEXT_DECODER_MIN_LENGTH && utf8TextDecoder) {
        return utf8TextDecoder.decode(this.buf.subarray(pos, end));
      }
      return readUtf8(this.buf, pos, end);
    }
    readBytes() {
      const end = this.readVarint() + this.pos, buffer = this.buf.subarray(this.pos, end);
      this.pos = end;
      return buffer;
    }
    // verbose for performance reasons; doesn't affect gzipped size
    /**
     * @param {number[]} [arr]
     * @param {boolean} [isSigned]
     */
    readPackedVarint(arr = [], isSigned) {
      const end = this.readPackedEnd();
      while (this.pos < end) arr.push(this.readVarint(isSigned));
      return arr;
    }
    /** @param {number[]} [arr] */
    readPackedSVarint(arr = []) {
      const end = this.readPackedEnd();
      while (this.pos < end) arr.push(this.readSVarint());
      return arr;
    }
    /** @param {boolean[]} [arr] */
    readPackedBoolean(arr = []) {
      const end = this.readPackedEnd();
      while (this.pos < end) arr.push(this.readBoolean());
      return arr;
    }
    /** @param {number[]} [arr] */
    readPackedFloat(arr = []) {
      const end = this.readPackedEnd();
      while (this.pos < end) arr.push(this.readFloat());
      return arr;
    }
    /** @param {number[]} [arr] */
    readPackedDouble(arr = []) {
      const end = this.readPackedEnd();
      while (this.pos < end) arr.push(this.readDouble());
      return arr;
    }
    /** @param {number[]} [arr] */
    readPackedFixed32(arr = []) {
      const end = this.readPackedEnd();
      while (this.pos < end) arr.push(this.readFixed32());
      return arr;
    }
    /** @param {number[]} [arr] */
    readPackedSFixed32(arr = []) {
      const end = this.readPackedEnd();
      while (this.pos < end) arr.push(this.readSFixed32());
      return arr;
    }
    /** @param {number[]} [arr] */
    readPackedFixed64(arr = []) {
      const end = this.readPackedEnd();
      while (this.pos < end) arr.push(this.readFixed64());
      return arr;
    }
    /** @param {number[]} [arr] */
    readPackedSFixed64(arr = []) {
      const end = this.readPackedEnd();
      while (this.pos < end) arr.push(this.readSFixed64());
      return arr;
    }
    readPackedEnd() {
      return this.type === PBF_BYTES ? this.readVarint() + this.pos : this.pos + 1;
    }
    /** @param {number} val */
    skip(val) {
      const type = val & 7;
      if (type === PBF_VARINT) while (this.buf[this.pos++] > 127) {
      }
      else if (type === PBF_BYTES) this.pos = this.readVarint() + this.pos;
      else if (type === PBF_FIXED32) this.pos += 4;
      else if (type === PBF_FIXED64) this.pos += 8;
      else throw new Error(`Unimplemented type: ${type}`);
    }
    // === WRITING =================================================================
    /**
     * @param {number} tag
     * @param {number} type
     */
    writeTag(tag, type) {
      this.writeVarint(tag << 3 | type);
    }
    /** @param {number} min */
    realloc(min) {
      let length = this.length || 16;
      while (length < this.pos + min) length *= 2;
      if (length !== this.length) {
        const buf = new Uint8Array(length);
        buf.set(this.buf);
        this.buf = buf;
        this.dataView = new DataView(buf.buffer);
        this.length = length;
      }
    }
    finish() {
      this.length = this.pos;
      this.pos = 0;
      return this.buf.subarray(0, this.length);
    }
    /** @param {number} val */
    writeFixed32(val) {
      this.realloc(4);
      this.dataView.setInt32(this.pos, val, true);
      this.pos += 4;
    }
    /** @param {number} val */
    writeSFixed32(val) {
      this.realloc(4);
      this.dataView.setInt32(this.pos, val, true);
      this.pos += 4;
    }
    /** @param {number} val */
    writeFixed64(val) {
      this.realloc(8);
      this.dataView.setInt32(this.pos, val & -1, true);
      this.dataView.setInt32(this.pos + 4, Math.floor(val * SHIFT_RIGHT_32), true);
      this.pos += 8;
    }
    /** @param {number} val */
    writeSFixed64(val) {
      this.realloc(8);
      this.dataView.setInt32(this.pos, val & -1, true);
      this.dataView.setInt32(this.pos + 4, Math.floor(val * SHIFT_RIGHT_32), true);
      this.pos += 8;
    }
    /** @param {number} val */
    writeVarint(val) {
      val = +val || 0;
      if (val > 268435455 || val < 0) {
        writeBigVarint(val, this);
        return;
      }
      this.realloc(4);
      this.buf[this.pos++] = val & 127 | (val > 127 ? 128 : 0);
      if (val <= 127) return;
      this.buf[this.pos++] = (val >>>= 7) & 127 | (val > 127 ? 128 : 0);
      if (val <= 127) return;
      this.buf[this.pos++] = (val >>>= 7) & 127 | (val > 127 ? 128 : 0);
      if (val <= 127) return;
      this.buf[this.pos++] = val >>> 7 & 127;
    }
    /** @param {number} val */
    writeSVarint(val) {
      this.writeVarint(val < 0 ? -val * 2 - 1 : val * 2);
    }
    /** @param {boolean} val */
    writeBoolean(val) {
      this.writeVarint(+val);
    }
    /** @param {string} str */
    writeString(str) {
      str = String(str);
      this.realloc(str.length * 4);
      this.pos++;
      const startPos = this.pos;
      this.pos = writeUtf8(this.buf, str, this.pos);
      const len = this.pos - startPos;
      if (len >= 128) makeRoomForExtraLength(startPos, len, this);
      this.pos = startPos - 1;
      this.writeVarint(len);
      this.pos += len;
    }
    /** @param {number} val */
    writeFloat(val) {
      this.realloc(4);
      this.dataView.setFloat32(this.pos, val, true);
      this.pos += 4;
    }
    /** @param {number} val */
    writeDouble(val) {
      this.realloc(8);
      this.dataView.setFloat64(this.pos, val, true);
      this.pos += 8;
    }
    /** @param {Uint8Array} buffer */
    writeBytes(buffer) {
      const len = buffer.length;
      this.writeVarint(len);
      this.realloc(len);
      for (let i = 0; i < len; i++) this.buf[this.pos++] = buffer[i];
    }
    /**
     * @template T
     * @param {(obj: T, pbf: Pbf) => void} fn
     * @param {T} obj
     */
    writeRawMessage(fn, obj) {
      this.pos++;
      const startPos = this.pos;
      fn(obj, this);
      const len = this.pos - startPos;
      if (len >= 128) makeRoomForExtraLength(startPos, len, this);
      this.pos = startPos - 1;
      this.writeVarint(len);
      this.pos += len;
    }
    /**
     * @template T
     * @param {number} tag
     * @param {(obj: T, pbf: Pbf) => void} fn
     * @param {T} obj
     */
    writeMessage(tag, fn, obj) {
      this.writeTag(tag, PBF_BYTES);
      this.writeRawMessage(fn, obj);
    }
    /**
     * @param {number} tag
     * @param {number[]} arr
     */
    writePackedVarint(tag, arr) {
      if (arr.length) this.writeMessage(tag, writePackedVarint, arr);
    }
    /**
     * @param {number} tag
     * @param {number[]} arr
     */
    writePackedSVarint(tag, arr) {
      if (arr.length) this.writeMessage(tag, writePackedSVarint, arr);
    }
    /**
     * @param {number} tag
     * @param {boolean[]} arr
     */
    writePackedBoolean(tag, arr) {
      if (arr.length) this.writeMessage(tag, writePackedBoolean, arr);
    }
    /**
     * @param {number} tag
     * @param {number[]} arr
     */
    writePackedFloat(tag, arr) {
      if (arr.length) this.writeMessage(tag, writePackedFloat, arr);
    }
    /**
     * @param {number} tag
     * @param {number[]} arr
     */
    writePackedDouble(tag, arr) {
      if (arr.length) this.writeMessage(tag, writePackedDouble, arr);
    }
    /**
     * @param {number} tag
     * @param {number[]} arr
     */
    writePackedFixed32(tag, arr) {
      if (arr.length) this.writeMessage(tag, writePackedFixed32, arr);
    }
    /**
     * @param {number} tag
     * @param {number[]} arr
     */
    writePackedSFixed32(tag, arr) {
      if (arr.length) this.writeMessage(tag, writePackedSFixed32, arr);
    }
    /**
     * @param {number} tag
     * @param {number[]} arr
     */
    writePackedFixed64(tag, arr) {
      if (arr.length) this.writeMessage(tag, writePackedFixed64, arr);
    }
    /**
     * @param {number} tag
     * @param {number[]} arr
     */
    writePackedSFixed64(tag, arr) {
      if (arr.length) this.writeMessage(tag, writePackedSFixed64, arr);
    }
    /**
     * @param {number} tag
     * @param {Uint8Array} buffer
     */
    writeBytesField(tag, buffer) {
      this.writeTag(tag, PBF_BYTES);
      this.writeBytes(buffer);
    }
    /**
     * @param {number} tag
     * @param {number} val
     */
    writeFixed32Field(tag, val) {
      this.writeTag(tag, PBF_FIXED32);
      this.writeFixed32(val);
    }
    /**
     * @param {number} tag
     * @param {number} val
     */
    writeSFixed32Field(tag, val) {
      this.writeTag(tag, PBF_FIXED32);
      this.writeSFixed32(val);
    }
    /**
     * @param {number} tag
     * @param {number} val
     */
    writeFixed64Field(tag, val) {
      this.writeTag(tag, PBF_FIXED64);
      this.writeFixed64(val);
    }
    /**
     * @param {number} tag
     * @param {number} val
     */
    writeSFixed64Field(tag, val) {
      this.writeTag(tag, PBF_FIXED64);
      this.writeSFixed64(val);
    }
    /**
     * @param {number} tag
     * @param {number} val
     */
    writeVarintField(tag, val) {
      this.writeTag(tag, PBF_VARINT);
      this.writeVarint(val);
    }
    /**
     * @param {number} tag
     * @param {number} val
     */
    writeSVarintField(tag, val) {
      this.writeTag(tag, PBF_VARINT);
      this.writeSVarint(val);
    }
    /**
     * @param {number} tag
     * @param {string} str
     */
    writeStringField(tag, str) {
      this.writeTag(tag, PBF_BYTES);
      this.writeString(str);
    }
    /**
     * @param {number} tag
     * @param {number} val
     */
    writeFloatField(tag, val) {
      this.writeTag(tag, PBF_FIXED32);
      this.writeFloat(val);
    }
    /**
     * @param {number} tag
     * @param {number} val
     */
    writeDoubleField(tag, val) {
      this.writeTag(tag, PBF_FIXED64);
      this.writeDouble(val);
    }
    /**
     * @param {number} tag
     * @param {boolean} val
     */
    writeBooleanField(tag, val) {
      this.writeVarintField(tag, +val);
    }
  };
  function readVarintRemainder(l, s, p) {
    const buf = p.buf;
    let h, b;
    b = buf[p.pos++];
    h = (b & 112) >> 4;
    if (b < 128) return toNum(l, h, s);
    b = buf[p.pos++];
    h |= (b & 127) << 3;
    if (b < 128) return toNum(l, h, s);
    b = buf[p.pos++];
    h |= (b & 127) << 10;
    if (b < 128) return toNum(l, h, s);
    b = buf[p.pos++];
    h |= (b & 127) << 17;
    if (b < 128) return toNum(l, h, s);
    b = buf[p.pos++];
    h |= (b & 127) << 24;
    if (b < 128) return toNum(l, h, s);
    b = buf[p.pos++];
    h |= (b & 1) << 31;
    if (b < 128) return toNum(l, h, s);
    throw new Error("Expected varint not more than 10 bytes");
  }
  function toNum(low, high, isSigned) {
    return isSigned ? high * 4294967296 + (low >>> 0) : (high >>> 0) * 4294967296 + (low >>> 0);
  }
  function writeBigVarint(val, pbf) {
    let low, high;
    if (val >= 0) {
      low = val % 4294967296 | 0;
      high = val / 4294967296 | 0;
    } else {
      low = ~(-val % 4294967296);
      high = ~(-val / 4294967296);
      if (low ^ 4294967295) {
        low = low + 1 | 0;
      } else {
        low = 0;
        high = high + 1 | 0;
      }
    }
    if (val >= 18446744073709552e3 || val < -18446744073709552e3) {
      throw new Error("Given varint doesn't fit into 10 bytes");
    }
    pbf.realloc(10);
    writeBigVarintLow(low, high, pbf);
    writeBigVarintHigh(high, pbf);
  }
  function writeBigVarintLow(low, high, pbf) {
    pbf.buf[pbf.pos++] = low & 127 | 128;
    low >>>= 7;
    pbf.buf[pbf.pos++] = low & 127 | 128;
    low >>>= 7;
    pbf.buf[pbf.pos++] = low & 127 | 128;
    low >>>= 7;
    pbf.buf[pbf.pos++] = low & 127 | 128;
    low >>>= 7;
    pbf.buf[pbf.pos] = low & 127;
  }
  function writeBigVarintHigh(high, pbf) {
    const lsb = (high & 7) << 4;
    pbf.buf[pbf.pos++] |= lsb | ((high >>>= 3) ? 128 : 0);
    if (!high) return;
    pbf.buf[pbf.pos++] = high & 127 | ((high >>>= 7) ? 128 : 0);
    if (!high) return;
    pbf.buf[pbf.pos++] = high & 127 | ((high >>>= 7) ? 128 : 0);
    if (!high) return;
    pbf.buf[pbf.pos++] = high & 127 | ((high >>>= 7) ? 128 : 0);
    if (!high) return;
    pbf.buf[pbf.pos++] = high & 127 | ((high >>>= 7) ? 128 : 0);
    if (!high) return;
    pbf.buf[pbf.pos++] = high & 127;
  }
  function makeRoomForExtraLength(startPos, len, pbf) {
    const extraLen = len <= 16383 ? 1 : len <= 2097151 ? 2 : len <= 268435455 ? 3 : Math.floor(Math.log(len) / (Math.LN2 * 7));
    pbf.realloc(extraLen);
    for (let i = pbf.pos - 1; i >= startPos; i--) pbf.buf[i + extraLen] = pbf.buf[i];
  }
  function writePackedVarint(arr, pbf) {
    for (let i = 0; i < arr.length; i++) pbf.writeVarint(arr[i]);
  }
  function writePackedSVarint(arr, pbf) {
    for (let i = 0; i < arr.length; i++) pbf.writeSVarint(arr[i]);
  }
  function writePackedFloat(arr, pbf) {
    for (let i = 0; i < arr.length; i++) pbf.writeFloat(arr[i]);
  }
  function writePackedDouble(arr, pbf) {
    for (let i = 0; i < arr.length; i++) pbf.writeDouble(arr[i]);
  }
  function writePackedBoolean(arr, pbf) {
    for (let i = 0; i < arr.length; i++) pbf.writeBoolean(arr[i]);
  }
  function writePackedFixed32(arr, pbf) {
    for (let i = 0; i < arr.length; i++) pbf.writeFixed32(arr[i]);
  }
  function writePackedSFixed32(arr, pbf) {
    for (let i = 0; i < arr.length; i++) pbf.writeSFixed32(arr[i]);
  }
  function writePackedFixed64(arr, pbf) {
    for (let i = 0; i < arr.length; i++) pbf.writeFixed64(arr[i]);
  }
  function writePackedSFixed64(arr, pbf) {
    for (let i = 0; i < arr.length; i++) pbf.writeSFixed64(arr[i]);
  }
  function readUtf8(buf, pos, end) {
    let str = "";
    let i = pos;
    while (i < end) {
      const b0 = buf[i];
      let c = null;
      let bytesPerSequence = b0 > 239 ? 4 : b0 > 223 ? 3 : b0 > 191 ? 2 : 1;
      if (i + bytesPerSequence > end) break;
      let b1, b2, b3;
      if (bytesPerSequence === 1) {
        if (b0 < 128) {
          c = b0;
        }
      } else if (bytesPerSequence === 2) {
        b1 = buf[i + 1];
        if ((b1 & 192) === 128) {
          c = (b0 & 31) << 6 | b1 & 63;
          if (c <= 127) {
            c = null;
          }
        }
      } else if (bytesPerSequence === 3) {
        b1 = buf[i + 1];
        b2 = buf[i + 2];
        if ((b1 & 192) === 128 && (b2 & 192) === 128) {
          c = (b0 & 15) << 12 | (b1 & 63) << 6 | b2 & 63;
          if (c <= 2047 || c >= 55296 && c <= 57343) {
            c = null;
          }
        }
      } else if (bytesPerSequence === 4) {
        b1 = buf[i + 1];
        b2 = buf[i + 2];
        b3 = buf[i + 3];
        if ((b1 & 192) === 128 && (b2 & 192) === 128 && (b3 & 192) === 128) {
          c = (b0 & 15) << 18 | (b1 & 63) << 12 | (b2 & 63) << 6 | b3 & 63;
          if (c <= 65535 || c >= 1114112) {
            c = null;
          }
        }
      }
      if (c === null) {
        c = 65533;
        bytesPerSequence = 1;
      } else if (c > 65535) {
        c -= 65536;
        str += String.fromCharCode(c >>> 10 & 1023 | 55296);
        c = 56320 | c & 1023;
      }
      str += String.fromCharCode(c);
      i += bytesPerSequence;
    }
    return str;
  }
  function writeUtf8(buf, str, pos) {
    for (let i = 0, c, lead; i < str.length; i++) {
      c = str.charCodeAt(i);
      if (c > 55295 && c < 57344) {
        if (lead) {
          if (c < 56320) {
            buf[pos++] = 239;
            buf[pos++] = 191;
            buf[pos++] = 189;
            lead = c;
            continue;
          } else {
            c = lead - 55296 << 10 | c - 56320 | 65536;
            lead = null;
          }
        } else {
          if (c > 56319 || i + 1 === str.length) {
            buf[pos++] = 239;
            buf[pos++] = 191;
            buf[pos++] = 189;
          } else {
            lead = c;
          }
          continue;
        }
      } else if (lead) {
        buf[pos++] = 239;
        buf[pos++] = 191;
        buf[pos++] = 189;
        lead = null;
      }
      if (c < 128) {
        buf[pos++] = c;
      } else {
        if (c < 2048) {
          buf[pos++] = c >> 6 | 192;
        } else {
          if (c < 65536) {
            buf[pos++] = c >> 12 | 224;
          } else {
            buf[pos++] = c >> 18 | 240;
            buf[pos++] = c >> 12 & 63 | 128;
          }
          buf[pos++] = c >> 6 & 63 | 128;
        }
        buf[pos++] = c & 63 | 128;
      }
    }
    return pos;
  }

  // .care-v3-map/kit/node_modules/@mapbox/point-geometry/index.js
  function Point(x, y) {
    this.x = x;
    this.y = y;
  }
  Point.prototype = {
    /**
     * Clone this point, returning a new point that can be modified
     * without affecting the old one.
     * @return {Point} the clone
     */
    clone() {
      return new Point(this.x, this.y);
    },
    /**
     * Add this point's x & y coordinates to another point,
     * yielding a new point.
     * @param {Point} p the other point
     * @return {Point} output point
     */
    add(p) {
      return this.clone()._add(p);
    },
    /**
     * Subtract this point's x & y coordinates to from point,
     * yielding a new point.
     * @param {Point} p the other point
     * @return {Point} output point
     */
    sub(p) {
      return this.clone()._sub(p);
    },
    /**
     * Multiply this point's x & y coordinates by point,
     * yielding a new point.
     * @param {Point} p the other point
     * @return {Point} output point
     */
    multByPoint(p) {
      return this.clone()._multByPoint(p);
    },
    /**
     * Divide this point's x & y coordinates by point,
     * yielding a new point.
     * @param {Point} p the other point
     * @return {Point} output point
     */
    divByPoint(p) {
      return this.clone()._divByPoint(p);
    },
    /**
     * Multiply this point's x & y coordinates by a factor,
     * yielding a new point.
     * @param {number} k factor
     * @return {Point} output point
     */
    mult(k) {
      return this.clone()._mult(k);
    },
    /**
     * Divide this point's x & y coordinates by a factor,
     * yielding a new point.
     * @param {number} k factor
     * @return {Point} output point
     */
    div(k) {
      return this.clone()._div(k);
    },
    /**
     * Rotate this point around the 0, 0 origin by an angle a,
     * given in radians
     * @param {number} a angle to rotate around, in radians
     * @return {Point} output point
     */
    rotate(a) {
      return this.clone()._rotate(a);
    },
    /**
     * Rotate this point around p point by an angle a,
     * given in radians
     * @param {number} a angle to rotate around, in radians
     * @param {Point} p Point to rotate around
     * @return {Point} output point
     */
    rotateAround(a, p) {
      return this.clone()._rotateAround(a, p);
    },
    /**
     * Multiply this point by a 4x1 transformation matrix
     * @param {[number, number, number, number]} m transformation matrix
     * @return {Point} output point
     */
    matMult(m) {
      return this.clone()._matMult(m);
    },
    /**
     * Calculate this point but as a unit vector from 0, 0, meaning
     * that the distance from the resulting point to the 0, 0
     * coordinate will be equal to 1 and the angle from the resulting
     * point to the 0, 0 coordinate will be the same as before.
     * @return {Point} unit vector point
     */
    unit() {
      return this.clone()._unit();
    },
    /**
     * Compute a perpendicular point, where the new y coordinate
     * is the old x coordinate and the new x coordinate is the old y
     * coordinate multiplied by -1
     * @return {Point} perpendicular point
     */
    perp() {
      return this.clone()._perp();
    },
    /**
     * Return a version of this point with the x & y coordinates
     * rounded to integers.
     * @return {Point} rounded point
     */
    round() {
      return this.clone()._round();
    },
    /**
     * Return the magnitude of this point: this is the Euclidean
     * distance from the 0, 0 coordinate to this point's x and y
     * coordinates.
     * @return {number} magnitude
     */
    mag() {
      return Math.sqrt(this.x * this.x + this.y * this.y);
    },
    /**
     * Judge whether this point is equal to another point, returning
     * true or false.
     * @param {Point} other the other point
     * @return {boolean} whether the points are equal
     */
    equals(other) {
      return this.x === other.x && this.y === other.y;
    },
    /**
     * Calculate the distance from this point to another point
     * @param {Point} p the other point
     * @return {number} distance
     */
    dist(p) {
      return Math.sqrt(this.distSqr(p));
    },
    /**
     * Calculate the distance from this point to another point,
     * without the square root step. Useful if you're comparing
     * relative distances.
     * @param {Point} p the other point
     * @return {number} distance
     */
    distSqr(p) {
      const dx = p.x - this.x, dy = p.y - this.y;
      return dx * dx + dy * dy;
    },
    /**
     * Get the angle from the 0, 0 coordinate to this point, in radians
     * coordinates.
     * @return {number} angle
     */
    angle() {
      return Math.atan2(this.y, this.x);
    },
    /**
     * Get the angle from this point to another point, in radians
     * @param {Point} b the other point
     * @return {number} angle
     */
    angleTo(b) {
      return Math.atan2(this.y - b.y, this.x - b.x);
    },
    /**
     * Get the angle between this point and another point, in radians
     * @param {Point} b the other point
     * @return {number} angle
     */
    angleWith(b) {
      return this.angleWithSep(b.x, b.y);
    },
    /**
     * Find the angle of the two vectors, solving the formula for
     * the cross product a x b = |a||b|sin(θ) for θ.
     * @param {number} x the x-coordinate
     * @param {number} y the y-coordinate
     * @return {number} the angle in radians
     */
    angleWithSep(x, y) {
      return Math.atan2(
        this.x * y - this.y * x,
        this.x * x + this.y * y
      );
    },
    /** @param {[number, number, number, number]} m */
    _matMult(m) {
      const x = m[0] * this.x + m[1] * this.y, y = m[2] * this.x + m[3] * this.y;
      this.x = x;
      this.y = y;
      return this;
    },
    /** @param {Point} p */
    _add(p) {
      this.x += p.x;
      this.y += p.y;
      return this;
    },
    /** @param {Point} p */
    _sub(p) {
      this.x -= p.x;
      this.y -= p.y;
      return this;
    },
    /** @param {number} k */
    _mult(k) {
      this.x *= k;
      this.y *= k;
      return this;
    },
    /** @param {number} k */
    _div(k) {
      this.x /= k;
      this.y /= k;
      return this;
    },
    /** @param {Point} p */
    _multByPoint(p) {
      this.x *= p.x;
      this.y *= p.y;
      return this;
    },
    /** @param {Point} p */
    _divByPoint(p) {
      this.x /= p.x;
      this.y /= p.y;
      return this;
    },
    _unit() {
      this._div(this.mag());
      return this;
    },
    _perp() {
      const y = this.y;
      this.y = this.x;
      this.x = -y;
      return this;
    },
    /** @param {number} angle */
    _rotate(angle) {
      const cos = Math.cos(angle), sin = Math.sin(angle), x = cos * this.x - sin * this.y, y = sin * this.x + cos * this.y;
      this.x = x;
      this.y = y;
      return this;
    },
    /**
     * @param {number} angle
     * @param {Point} p
     */
    _rotateAround(angle, p) {
      const cos = Math.cos(angle), sin = Math.sin(angle), x = p.x + cos * (this.x - p.x) - sin * (this.y - p.y), y = p.y + sin * (this.x - p.x) + cos * (this.y - p.y);
      this.x = x;
      this.y = y;
      return this;
    },
    _round() {
      this.x = Math.round(this.x);
      this.y = Math.round(this.y);
      return this;
    },
    constructor: Point
  };
  Point.convert = function(p) {
    if (p instanceof Point) {
      return (
        /** @type {Point} */
        p
      );
    }
    if (Array.isArray(p)) {
      return new Point(+p[0], +p[1]);
    }
    if (p.x !== void 0 && p.y !== void 0) {
      return new Point(+p.x, +p.y);
    }
    throw new Error("Expected [x, y] or {x, y} point format");
  };

  // .care-v3-map/kit/node_modules/@mapbox/vector-tile/index.js
  var VectorTileFeature = class {
    /**
     * @param {Pbf} pbf
     * @param {number} end
     * @param {number} extent
     * @param {string[]} keys
     * @param {(number | string | boolean)[]} values
     */
    constructor(pbf, end, extent, keys, values) {
      this.properties = {};
      this.extent = extent;
      this.type = 0;
      this.id = void 0;
      this._pbf = pbf;
      this._geometry = -1;
      this._keys = keys;
      this._values = values;
      pbf.readFields(readFeature, this, end);
    }
    loadGeometry() {
      const pbf = this._pbf;
      pbf.pos = this._geometry;
      const end = pbf.readVarint() + pbf.pos;
      const lines = [];
      let line;
      let cmd = 1;
      let length = 0;
      let x = 0;
      let y = 0;
      while (pbf.pos < end) {
        if (length <= 0) {
          const cmdLen = pbf.readVarint();
          cmd = cmdLen & 7;
          length = cmdLen >> 3;
        }
        length--;
        if (cmd === 1 || cmd === 2) {
          x += pbf.readSVarint();
          y += pbf.readSVarint();
          if (cmd === 1) {
            if (line) lines.push(line);
            line = [];
          }
          if (line) line.push(new Point(x, y));
        } else if (cmd === 7) {
          if (line) {
            line.push(line[0].clone());
          }
        } else {
          throw new Error(`unknown command ${cmd}`);
        }
      }
      if (line) lines.push(line);
      return lines;
    }
    bbox() {
      const pbf = this._pbf;
      pbf.pos = this._geometry;
      const end = pbf.readVarint() + pbf.pos;
      let cmd = 1, length = 0, x = 0, y = 0, x1 = Infinity, x2 = -Infinity, y1 = Infinity, y2 = -Infinity;
      while (pbf.pos < end) {
        if (length <= 0) {
          const cmdLen = pbf.readVarint();
          cmd = cmdLen & 7;
          length = cmdLen >> 3;
        }
        length--;
        if (cmd === 1 || cmd === 2) {
          x += pbf.readSVarint();
          y += pbf.readSVarint();
          if (x < x1) x1 = x;
          if (x > x2) x2 = x;
          if (y < y1) y1 = y;
          if (y > y2) y2 = y;
        } else if (cmd !== 7) {
          throw new Error(`unknown command ${cmd}`);
        }
      }
      return [x1, y1, x2, y2];
    }
    /**
     * @param {number} x
     * @param {number} y
     * @param {number} z
     * @return {Feature}
     */
    toGeoJSON(x, y, z) {
      const size = this.extent * Math.pow(2, z), x0 = this.extent * x, y0 = this.extent * y, vtCoords = this.loadGeometry();
      function projectPoint(p) {
        return [
          (p.x + x0) * 360 / size - 180,
          360 / Math.PI * Math.atan(Math.exp((1 - (p.y + y0) * 2 / size) * Math.PI)) - 90
        ];
      }
      function projectLine(line) {
        return line.map(projectPoint);
      }
      let geometry;
      if (this.type === 1) {
        const points = [];
        for (const line of vtCoords) {
          points.push(line[0]);
        }
        const coordinates = projectLine(points);
        geometry = points.length === 1 ? { type: "Point", coordinates: coordinates[0] } : { type: "MultiPoint", coordinates };
      } else if (this.type === 2) {
        const coordinates = vtCoords.map(projectLine);
        geometry = coordinates.length === 1 ? { type: "LineString", coordinates: coordinates[0] } : { type: "MultiLineString", coordinates };
      } else if (this.type === 3) {
        const polygons = classifyRings(vtCoords);
        const coordinates = [];
        for (const polygon of polygons) {
          coordinates.push(polygon.map(projectLine));
        }
        geometry = coordinates.length === 1 ? { type: "Polygon", coordinates: coordinates[0] } : { type: "MultiPolygon", coordinates };
      } else {
        throw new Error("unknown feature type");
      }
      const result = {
        type: "Feature",
        geometry,
        properties: this.properties
      };
      if (this.id != null) {
        result.id = this.id;
      }
      return result;
    }
  };
  VectorTileFeature.types = ["Unknown", "Point", "LineString", "Polygon"];
  function readFeature(tag, feature, pbf) {
    if (tag === 1) feature.id = pbf.readVarint();
    else if (tag === 2) readTag(pbf, feature);
    else if (tag === 3) feature.type = /** @type {0 | 1 | 2 | 3} */
    pbf.readVarint();
    else if (tag === 4) feature._geometry = pbf.pos;
  }
  function readTag(pbf, feature) {
    const end = pbf.readVarint() + pbf.pos;
    while (pbf.pos < end) {
      const key2 = feature._keys[pbf.readVarint()];
      const value = feature._values[pbf.readVarint()];
      feature.properties[key2] = value;
    }
  }
  function classifyRings(rings) {
    const len = rings.length;
    if (len <= 1) return [rings];
    const polygons = [];
    let polygon, ccw;
    for (let i = 0; i < len; i++) {
      const area = signedArea(rings[i]);
      if (area === 0) continue;
      if (ccw === void 0) ccw = area < 0;
      if (ccw === area < 0) {
        if (polygon) polygons.push(polygon);
        polygon = [rings[i]];
      } else if (polygon) {
        polygon.push(rings[i]);
      }
    }
    if (polygon) polygons.push(polygon);
    return polygons;
  }
  function signedArea(ring) {
    let sum = 0;
    for (let i = 0, len = ring.length, j = len - 1, p1, p2; i < len; j = i++) {
      p1 = ring[i];
      p2 = ring[j];
      sum += (p2.x - p1.x) * (p1.y + p2.y);
    }
    return sum;
  }
  var VectorTileLayer = class {
    /**
     * @param {Pbf} pbf
     * @param {number} [end]
     */
    constructor(pbf, end) {
      this.version = 1;
      this.name = "";
      this.extent = 4096;
      this.length = 0;
      this._pbf = pbf;
      this._keys = [];
      this._values = [];
      this._features = [];
      pbf.readFields(readLayer, this, end);
      this.length = this._features.length;
    }
    /** return feature `i` from this layer as a `VectorTileFeature`
     * @param {number} i
     */
    feature(i) {
      if (i < 0 || i >= this._features.length) throw new Error("feature index out of bounds");
      this._pbf.pos = this._features[i];
      const end = this._pbf.readVarint() + this._pbf.pos;
      return new VectorTileFeature(this._pbf, end, this.extent, this._keys, this._values);
    }
  };
  function readLayer(tag, layer, pbf) {
    if (tag === 15) layer.version = pbf.readVarint();
    else if (tag === 1) layer.name = pbf.readString();
    else if (tag === 5) layer.extent = pbf.readVarint();
    else if (tag === 2) layer._features.push(pbf.pos);
    else if (tag === 3) layer._keys.push(pbf.readString());
    else if (tag === 4) layer._values.push(readValueMessage(pbf));
  }
  function readValueMessage(pbf) {
    let value = null;
    const end = pbf.readVarint() + pbf.pos;
    while (pbf.pos < end) {
      const tag = pbf.readVarint() >> 3;
      value = tag === 1 ? pbf.readString() : tag === 2 ? pbf.readFloat() : tag === 3 ? pbf.readDouble() : tag === 4 ? pbf.readVarint64() : tag === 5 ? pbf.readVarint() : tag === 6 ? pbf.readSVarint() : tag === 7 ? pbf.readBoolean() : null;
    }
    if (value == null) {
      throw new Error("unknown feature value");
    }
    return value;
  }
  var VectorTile = class {
    /**
     * @param {Pbf} pbf
     * @param {number} [end]
     */
    constructor(pbf, end) {
      this.layers = pbf.readFields(readTile, {}, end);
    }
  };
  function readTile(tag, layers, pbf) {
    if (tag === 3) {
      const layer = new VectorTileLayer(pbf, pbf.readVarint() + pbf.pos);
      if (layer.length) layers[layer.name] = layer;
    }
  }

  // .care-v3-map/kit/codec.mjs
  var EXTENT = 4096;
  var roadClasses = ["path", "track", "service", "minor", "tertiary", "secondary", "primary", "trunk", "motorway", "rail"];
  var placeClasses = ["neighbourhood", "quarter", "suburb", "village", "town", "city"];
  var roadRank = new Map(roadClasses.map((c, i) => [c, i]));
  var placeRank = new Map(placeClasses.map((c, i) => [c, i]));
  function nameOf(p) {
    return String(p["name:en"] || p.name_en || p.name_int || p.name || p.ref || "").trim();
  }
  function paths(f, extent) {
    const factor = EXTENT / extent, lines = [];
    for (const part of f.loadGeometry()) {
      if (!part.length) continue;
      let prevX = 0, prevY = 0;
      const line = [];
      for (const p of part) {
        const x = Math.round(p.x * factor), y = Math.round(p.y * factor);
        if (line.length && x === prevX && y === prevY) continue;
        line.push(x - prevX, y - prevY);
        prevX = x;
        prevY = y;
      }
      if (line.length >= 4) lines.push(line);
    }
    return lines;
  }
  function decodeTile(bytes, zoom) {
    const tile = new VectorTile(new Pbf(bytes)), roads = Array.from({ length: roadClasses.length }, () => []), fills = Array.from({ length: 4 }, () => []), labels = [];
    for (const key2 of ["landcover", "park", "water", "waterway", "transportation", "transportation_name", "place"]) {
      const layer = tile.layers[key2];
      if (!layer) continue;
      for (let i = 0; i < layer.length; i++) {
        const f = layer.feature(i), p = f.properties, c = p.class;
        if (key2 === "place") {
          const importance = placeRank.get(c), name = nameOf(p);
          if (importance == null || !name || f.type !== 1) continue;
          const p0 = f.loadGeometry()[0]?.[0];
          if (!p0) continue;
          const x = Math.round(p0.x * EXTENT / layer.extent), y = Math.round(p0.y * EXTENT / layer.extent);
          if (x < 0 || x >= EXTENT || y < 0 || y >= EXTENT) continue;
          labels.push([1, importance, name, x, y]);
          continue;
        }
        if (key2 === "transportation_name") {
          const rank = roadRank.get(c), name = nameOf(p);
          if (rank == null || !name || f.type !== 2) continue;
          const lines = paths(f, layer.extent);
          if (lines.length) labels.push([0, rank, name, lines]);
          continue;
        }
        if (key2 === "transportation") {
          const rank = roadRank.get(c);
          if (rank == null || f.type !== 2) continue;
          roads[rank].push(...paths(f, layer.extent));
          continue;
        }
        if (key2 === "water" && f.type === 3) {
          fills[2].push(...paths(f, layer.extent));
          continue;
        }
        if (key2 === "waterway" && f.type === 2 && (c === "river" || c === "canal" || zoom >= 13)) {
          fills[3].push(...paths(f, layer.extent));
          continue;
        }
        if (f.type === 3 && (key2 === "landcover" && ["wood", "grass", "farmland", "forest", "wetland"].includes(c) || key2 === "park")) {
          fills[key2 === "park" || c === "wood" || c === "forest" ? 1 : 0].push(...paths(f, layer.extent));
        }
      }
    }
    return [roads, fills, labels];
  }
  function absolutePaths(lines) {
    return lines.map((d) => {
      const flat = new Float32Array(d.length);
      let x = 0, y = 0;
      for (let k = 0; k < d.length; k += 2) {
        x += d[k];
        y += d[k + 1];
        flat[k] = x;
        flat[k + 1] = y;
      }
      return flat;
    });
  }
  function prepareTile(data) {
    const [roads, fills, labels] = data;
    return {
      roads: roads.map(absolutePaths),
      fills: fills.map(absolutePaths),
      labels: labels.map((l) => l[0] === 0 ? [0, l[1], l[2], absolutePaths(l[3])] : l)
    };
  }

  // .care-v3-map/kit/streets-src.mjs
  var tileMemo = /* @__PURE__ */ new Map();
  var requestMemo = /* @__PURE__ */ new Map();
  var failureUntil = /* @__PURE__ */ new Map();
  var LIMIT = 80;
  var NATIVE_MAX = 14;
  var MIN_ZOOM = 8;
  var credits = '<a href="https://openfreemap.org/" target="_blank" rel="noopener">OpenFreeMap</a> \xB7 \xA9 <a href="https://openmaptiles.org/" target="_blank" rel="noopener">OpenMapTiles</a> \xB7 \xA9 <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap contributors</a>';
  var key = (z, x, y) => z + "/" + x + "/" + y;
  function inIndiaView(z, x, y) {
    if (z < MIN_ZOOM || z > NATIVE_MAX || !Number.isInteger(x) || !Number.isInteger(y)) return false;
    const n = 2 ** z, lat = (v) => 180 / Math.PI * Math.atan(Math.sinh(Math.PI * (1 - 2 * v / n)));
    return x >= 0 && y >= 0 && x < n && y < n && x / n * 360 - 180 < 99.75 && (x + 1) / n * 360 - 180 > 65.9 && lat(y) > 5 && lat(y + 1) < 38.8;
  }
  function cached(id) {
    const v = tileMemo.get(id);
    if (v) {
      tileMemo.delete(id);
      tileMemo.set(id, v);
    }
    return v;
  }
  function remember(id, v) {
    tileMemo.set(id, v);
    if (tileMemo.size > LIMIT) tileMemo.delete(tileMemo.keys().next().value);
    return v;
  }
  function localSource(z, x, y) {
    const saved = window.CARE_STREET_TILES || {};
    for (const level of [14, 12, 11, 9]) {
      if (level > z) continue;
      const shift = 2 ** (z - level), sx = Math.floor(x / shift), sy = Math.floor(y / shift), id = key(level, sx, sy);
      if (!saved[id]) continue;
      let tile = cached(id);
      if (!tile) {
        const binary = atob(saved[id]);
        const compressed = Uint8Array.from(binary, (c) => c.charCodeAt(0));
        tile = remember(id, prepareTile(JSON.parse(strFromU8(gunzipSync(compressed)))));
      }
      return { tile, z: level, x: sx, y: sy, id };
    }
    return null;
  }
  var externalRoot = "https://tiles.openfreemap.org/planet";
  var catalog = null;
  var catalogRetry = 0;
  async function timedFetch(url, timeout, signal) {
    const controller = new AbortController(), abort = () => controller.abort();
    if (signal?.aborted) throw new DOMException("cancelled", "AbortError");
    signal?.addEventListener("abort", abort, { once: true });
    const timer = setTimeout(abort, timeout);
    try {
      const response = await fetch(url, { mode: "cors", credentials: new URL(url, location.href).origin === location.origin ? "same-origin" : "omit", signal: controller.signal });
      if (!response.ok) throw Error("Tile service unavailable");
      const bytes = new Uint8Array(await response.arrayBuffer());
      if (!bytes.length || bytes.length > 5e6) throw Error("Unexpected tile");
      return bytes;
    } finally {
      clearTimeout(timer);
      signal?.removeEventListener("abort", abort);
    }
  }
  function liveCatalog() {
    if (catalog) return catalog;
    if (Date.now() < catalogRetry) return Promise.reject(Error("Map catalog unavailable"));
    catalog = (async () => {
      const bytes = await timedFetch(externalRoot, 3500);
      const u = JSON.parse(new TextDecoder().decode(bytes)).tiles?.[0];
      if (typeof u !== "string" || !/^https:\/\/tiles\.openfreemap\.org\/planet\/[a-zA-Z0-9_-]+\/\{z\}\/\{x\}\/\{y\}\.pbf$/.test(u)) throw Error("Unexpected map catalog");
      return u;
    })().catch((e) => {
      catalog = null;
      catalogRetry = Date.now() + 3e4;
      throw e;
    });
    return catalog;
  }
  function hosted() {
    return document.querySelector('meta[name="care-mode"]')?.content !== "standalone" && location.protocol !== "file:";
  }
  async function onlineSource(z, x, y) {
    const id = key(z, x, y), known = cached(id);
    if (known) return { tile: known, z, x, y, id };
    if ((failureUntil.get(id) || 0) > Date.now()) throw Error("Recently unavailable");
    if (requestMemo.has(id)) return requestMemo.get(id);
    const job = (async () => {
      const controller = new AbortController();
      const remote = async () => {
        const endpoint = await liveCatalog();
        const u = endpoint.replace("{z}", z).replace("{x}", x).replace("{y}", y);
        return timedFetch(u, 4200, controller.signal);
      };
      const jobs = [remote()];
      if (hosted()) jobs.push((async () => {
        await new Promise((r) => setTimeout(r, 350));
        return timedFetch("./api/streets/" + id + ".pbf", 4500, controller.signal);
      })());
      try {
        const data = await Promise.any(jobs);
        const bytes = data[0] === 31 && data[1] === 139 ? gunzipSync(data) : data;
        const tile = remember(id, prepareTile(decodeTile(bytes, z)));
        failureUntil.delete(id);
        return { tile, z, x, y, id };
      } catch (e) {
        failureUntil.set(id, Date.now() + 3e4);
        if (failureUntil.size > 256) failureUntil.delete(failureUntil.keys().next().value);
        throw e;
      } finally {
        controller.abort();
      }
    })();
    requestMemo.set(id, job);
    try {
      return await job;
    } finally {
      requestMemo.delete(id);
    }
  }
  function addPaths(ctx, lines, s, ox, oy) {
    for (const flat of lines) {
      ctx.moveTo(flat[0] * s + ox, flat[1] * s + oy);
      for (let k = 2; k < flat.length; k += 2) ctx.lineTo(flat[k] * s + ox, flat[k + 1] * s + oy);
    }
  }
  var widths = [
    [0, 0, 0, 0.35, 0.65, 1.05, 1.7, 2.2, 2.55, 0.7],
    // z11
    [0.55, 0.6, 0.7, 1.15, 1.65, 2, 2.6, 3.05, 3.6, 0.9],
    // z14
    [1, 1.3, 1.6, 2.8, 3.6, 4.4, 5.2, 6, 6.5, 1.2]
    // z17
  ];
  function roadWidth(rank, z) {
    const group = z < 14 ? 0 : 1, t = Math.max(0, Math.min(1, (z - (group ? 14 : 11)) / 3));
    let width = widths[group][rank] * (1 - t) + widths[group + 1][rank] * t;
    if (z < 11) width *= Math.max(0.45, 1 - (11 - z) * 0.17);
    if (z > 17) width *= 1 + 0.18 * (z - 17);
    return width;
  }
  function paint(canvas, c, src) {
    const ratio = Math.min(window.devicePixelRatio || 1, 2), ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    ctx.clearRect(0, 0, 256, 256);
    if (!src) return;
    const scale = 2 ** (c.z - src.z), s = 256 * scale / EXTENT, ox = (src.x * scale - c.x) * 256, oy = (src.y * scale - c.y) * 256;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    const [land, park, water, rivers] = src.tile.fills;
    const fill = (lines, style) => {
      if (!lines.length) return;
      ctx.beginPath();
      addPaths(ctx, lines, s, ox, oy);
      ctx.fillStyle = style;
      ctx.fill();
    };
    fill(land, "rgba(205,224,201,.72)");
    fill(park, "rgba(179,211,179,.69)");
    fill(water, "#b8d7e6");
    if (rivers.length) {
      ctx.beginPath();
      addPaths(ctx, rivers, s, ox, oy);
      ctx.strokeStyle = "#9fc8dc";
      ctx.lineWidth = c.z < 13 ? 0.85 : 1.35;
      ctx.stroke();
    }
    const roads = src.tile.roads;
    for (const order of [9, 0, 1, 2, 3, 4, 5, 6, 7, 8]) {
      const lines = roads[order], w = roadWidth(order, c.z);
      if (!lines.length || w <= 0.1) continue;
      ctx.beginPath();
      addPaths(ctx, lines, s, ox, oy);
      if (order === 9) {
        ctx.setLineDash([3, 2]);
        ctx.strokeStyle = "#97a5ae";
        ctx.lineWidth = w;
        ctx.stroke();
        ctx.setLineDash([]);
        continue;
      }
      ctx.strokeStyle = order < 3 ? "#cbd2d1" : order < 5 ? "#afbfcb" : order < 7 ? "#aabac5" : "#bcab84";
      ctx.lineWidth = w + Math.min(1.4, 0.38 + w * 0.24);
      ctx.stroke();
      if (order > 1) {
        ctx.strokeStyle = order >= 7 ? "#ffe3ae" : order >= 5 ? "#fff7df" : "#fffefd";
        ctx.lineWidth = w;
        ctx.stroke();
      }
    }
  }
  function chooseLabelCandidates(map, sources) {
    const z = map.getZoom(), size = map.getSize(), worldCenter = map.project(map.getCenter(), z);
    const minX = worldCenter.x - size.x / 2, minY = worldCenter.y - size.y / 2, list = [];
    const inside = (x, y, margin = 8) => x > margin && x < size.x - margin && y > margin && y < size.y - margin;
    for (const src of sources) {
      const span = 256 * 2 ** (z - src.z), unit = span / EXTENT, baseX = src.x * span - minX, baseY = src.y * span - minY;
      for (const item of src.tile.labels) {
        const [type, rank, label] = item;
        if (type === 1) {
          if (rank >= 4 || z < (rank >= 2 ? 12.2 : 13.6)) continue;
          const x = baseX + item[3] * unit, y = baseY + item[4] * unit;
          if (inside(x, y)) list.push({ x, y, angle: 0, label, kind: "place", priority: rank >= 2 ? 4.75 : 2.5 });
          continue;
        }
        if (rank === 9 || rank < (z < 10 ? 6 : z < 11.6 ? 5 : z < 12.8 ? 4 : z < 14 ? 3 : 0)) continue;
        const lengthLimit = Math.max(20, Math.min(115, label.length * (z >= 15 ? 5.7 : 5.1)));
        for (const line of item[3]) {
          let bx = null, by = null, best = 0, run = 0, px = 0, py = 0;
          const submit = () => {
            if (bx !== null && by !== null && best > lengthLimit * 0.47) list.push({ x: bx.x, y: bx.y, angle: Math.atan2(by.y, by.x), label, kind: "road", priority: rank + Math.min(0.45, best / 950) });
            bx = null;
            by = null;
            best = 0;
            run = 0;
          };
          for (let k = 0; k < line.length; k += 2) {
            const x = baseX + line[k] * unit, y = baseY + line[k + 1] * unit;
            if (k) {
              const dx = x - px, dy = y - py, len = Math.hypot(dx, dy);
              const steps = Math.min(20, Math.max(1, Math.ceil(len / 45)));
              for (let j = 0; j < steps; j++) {
                const at = (j + 0.5) / steps, qx = px + at * dx, qy = py + at * dy;
                if (!inside(qx, qy, 10)) {
                  if (run) submit();
                  continue;
                }
                run += len / steps;
                if (run > lengthLimit * 0.25 && (!bx || len > best)) {
                  bx = { x: qx, y: qy };
                  by = { x: dx, y: dy };
                  best = Math.max(len, run);
                }
                if (run > Math.max(160, lengthLimit * 2.6)) submit();
              }
            }
            px = x;
            py = y;
          }
          submit();
        }
      }
    }
    return list.sort((a, b) => b.priority - a.priority || a.label.localeCompare(b.label));
  }
  function styleOnce() {
    if (document.getElementById("care-street-label-style")) return;
    const s = document.createElement("style");
    s.id = "care-street-label-style";
    s.textContent = ".care-street-labels,.care-street-label{pointer-events:none!important}.care-street-label{position:absolute;left:0;top:0;white-space:nowrap;color:#3b4f62;transform-origin:center;font:500 11px/1.25 system-ui,-apple-system,sans-serif;text-shadow:0 0 2px #fff,1px 1px 1px #fff,-1px -1px 1px #fff,1px -1px 1px #fff,-1px 1px 1px #fff}.care-street-label.place{font-weight:620;color:#566474;font-size:11.5px}.care-street-labels{position:absolute;inset:0;overflow:visible}.care-street-raster{pointer-events:none!important}";
    document.head.append(s);
  }
  function install(map, onDetail = () => {
  }) {
    styleOnce();
    for (const [name, z] of [["careStreetPaint", 236], ["careStreetNames", 244]]) {
      const pane = map.getPane(name) || map.createPane(name);
      pane.style.zIndex = String(z);
      pane.style.pointerEvents = "none";
    }
    const names = L.DomUtil.create("div", "care-street-labels", map.getPane("careStreetNames"));
    names.setAttribute("aria-hidden", "true");
    let frame = 0, zooming = false, lastNote = null;
    function schedule() {
      if (!frame) frame = requestAnimationFrame(layout);
    }
    function layout() {
      frame = 0;
      if (zooming) return;
      const saved = /* @__PURE__ */ new Map(), seen = /* @__PURE__ */ new Set(), boxes = [], fragment = document.createDocumentFragment();
      const mapBox = map.getContainer().getBoundingClientRect();
      let degraded = 0, total = 0, complete = 0;
      for (const item of Object.values(layer._tiles || {})) {
        const el = item.el, rect = el.getBoundingClientRect();
        if (!item.current || rect.right <= mapBox.left || rect.left >= mapBox.right || rect.bottom <= mapBox.top || rect.top >= mapBox.bottom) continue;
        total++;
        if (el.careSource) saved.set(el.careSource.id, el.careSource);
        if (el.dataset.coverage === "unavailable") degraded++;
        else if (el.dataset.coverage === "detail") complete++;
      }
      let note = "";
      if (degraded && (!complete || degraded > total / 3)) note = "Showing saved geography \xB7 some street detail is unavailable";
      if (note !== lastNote) {
        onDetail(note);
        lastNote = note;
      }
      const size = map.getSize(), offset = map.containerPointToLayerPoint([0, 0]);
      const maximum = Math.max(8, Math.ceil(size.x * size.y / 7800));
      for (const c of chooseLabelCandidates(map, [...saved.values()])) {
        if (seen.has(c.label) || boxes.length > maximum) continue;
        let angle = c.angle;
        if (angle > Math.PI / 2) angle -= Math.PI;
        if (angle < -Math.PI / 2) angle += Math.PI;
        angle = Math.max(-0.6, Math.min(0.6, angle));
        const w = Math.max(27, c.label.length * (c.kind === "place" ? 6.5 : 5.9)) + 7;
        const hw = Math.abs(Math.cos(angle)) * w / 2 + Math.abs(Math.sin(angle)) * 7;
        const hh = Math.abs(Math.sin(angle)) * w / 2 + Math.abs(Math.cos(angle)) * 7;
        const rect = { l: c.x - hw - 4, r: c.x + hw + 4, t: c.y - hh - 3, b: c.y + hh + 3 };
        if (rect.l < 3 || rect.r > size.x - 3 || rect.t < 4 || rect.b > size.y - 4 || boxes.some((b) => !(b.r < rect.l || b.l > rect.r || b.b < rect.t || b.t > rect.b))) continue;
        const el = document.createElement("span");
        el.className = "care-street-label " + c.kind;
        el.textContent = c.label;
        el.style.left = c.x + offset.x + "px";
        el.style.top = c.y + offset.y + "px";
        el.style.transform = "translate(-50%,-50%) rotate(" + angle + "rad)";
        fragment.append(el);
        seen.add(c.label);
        boxes.push(rect);
      }
      names.replaceChildren(fragment);
    }
    const Grid = L.GridLayer.extend({
      createTile(c) {
        const cv = document.createElement("canvas"), ratio = Math.min(devicePixelRatio || 1, 2);
        cv.width = cv.height = Math.round(256 * ratio);
        cv.setAttribute("aria-hidden", "true");
        cv.dataset.coverage = "overview";
        const z = Math.min(c.z, NATIVE_MAX), k = 2 ** (c.z - z), x = Math.floor(c.x / k), y = Math.floor(c.y / k);
        if (!inIndiaView(z, x, y)) return cv;
        const render = (src, quality) => {
          cv.careSource = src;
          cv.dataset.coverage = quality;
          paint(cv, c, src);
          schedule();
        };
        const local = localSource(c.z, c.x, c.y);
        if (local) render(local, local.z === z ? "detail" : "saved");
        if (local?.z === z) return cv;
        if (!navigator.onLine) {
          cv.dataset.coverage = "unavailable";
          schedule();
          return cv;
        }
        onlineSource(z, x, y).then((src) => {
          if (cv.isConnected) render(src, "detail");
        }).catch(() => {
          cv.dataset.coverage = "unavailable";
          schedule();
        });
        return cv;
      }
    });
    const layer = new Grid({ pane: "careStreetPaint", noWrap: true, minZoom: MIN_ZOOM, maxZoom: 19, keepBuffer: 0, updateWhenIdle: false, updateInterval: 100, attribution: credits }).addTo(map);
    const onZoomStart = () => {
      zooming = true;
      names.style.visibility = "hidden";
    }, onZoomEnd = () => {
      zooming = false;
      names.style.visibility = "";
      schedule();
    };
    layer.on("load tileload tileunload", schedule);
    map.on("zoomstart", onZoomStart).on("zoomend", onZoomEnd).on("move resize moveend", schedule);
    function reconnect() {
      failureUntil.clear();
      catalogRetry = 0;
      layer.redraw();
    }
    window.addEventListener("online", reconnect);
    layer.on("remove", () => {
      window.removeEventListener("online", reconnect);
      map.off("zoomstart", onZoomStart).off("zoomend", onZoomEnd).off("move resize moveend", schedule);
      cancelAnimationFrame(frame);
      names.remove();
    });
    schedule();
    return layer;
  }
  window.CareStreets = { addTo: install };
})();
