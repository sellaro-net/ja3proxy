// Generated from Rust service DTO schemas. Run contracts:generate; do not edit.
/*! Bundled AJV standalone helpers
The MIT License (MIT)

Copyright (c) 2015-2021 Evgeny Poberezkin

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.


*/
// standalone-validators.js
var requestMetadata = validate10;
var schema11 = { "$id": "https://ja3proxy.invalid/contracts/requestMetadata.schema.json", "$schema": "http://json-schema.org/draft-07/schema#", "additionalProperties": false, "definitions": { "BrowserIdentity": { "additionalProperties": false, "properties": { "emulateHeaders": { "type": "boolean" }, "tlsProfile": { "type": "string" }, "userAgent": { "type": ["string", "null"] } }, "required": ["tlsProfile", "emulateHeaders"], "type": "object" }, "ConnectionSpec": { "additionalProperties": false, "properties": { "egress": { "$ref": "#/definitions/Egress" }, "identity": { "$ref": "#/definitions/BrowserIdentity" } }, "required": ["egress", "identity"], "type": "object" }, "Egress": { "oneOf": [{ "additionalProperties": false, "properties": { "mode": { "const": "direct", "type": "string" } }, "required": ["mode"], "type": "object" }, { "additionalProperties": false, "properties": { "mode": { "const": "proxy", "type": "string" }, "url": { "type": "string" } }, "required": ["mode", "url"], "type": "object" }] } }, "properties": { "attempt": { "format": "uint64", "minimum": 0, "type": "integer", "maximum": 9007199254740991 }, "bodyLength": { "default": null, "format": "uint64", "minimum": 0, "type": ["integer", "null"], "maximum": 9007199254740991 }, "connection": { "anyOf": [{ "$ref": "#/definitions/ConnectionSpec" }, { "type": "null" }], "default": null }, "contextId": { "default": null, "type": ["string", "null"] }, "hasBody": { "type": "boolean" }, "headers": { "items": { "items": [{ "type": "string" }, { "type": "string" }], "maxItems": 2, "minItems": 2, "type": "array" }, "type": "array" }, "maxResponseBytes": { "format": "uint64", "minimum": 0, "type": "integer", "maximum": 9007199254740991 }, "method": { "type": "string" }, "partition": { "type": "string" }, "requestId": { "type": "string" }, "timeoutMs": { "format": "uint64", "minimum": 0, "type": "integer", "maximum": 9007199254740991 }, "url": { "type": "string" } }, "required": ["requestId", "partition", "url", "method", "headers", "hasBody", "timeoutMs", "maxResponseBytes", "attempt"], "title": "RequestMetadata", "type": "object" };
var func2 = Object.prototype.hasOwnProperty;
var schema14 = { "additionalProperties": false, "properties": { "emulateHeaders": { "type": "boolean" }, "tlsProfile": { "type": "string" }, "userAgent": { "type": ["string", "null"] } }, "required": ["tlsProfile", "emulateHeaders"], "type": "object" };
function validate11(data, { instancePath = "", parentData, parentDataProperty, rootData = data } = {}) {
  let vErrors = null;
  let errors = 0;
  if (errors === 0) {
    if (data && typeof data == "object" && !Array.isArray(data)) {
      let missing0;
      if (data.egress === void 0 && (missing0 = "egress") || data.identity === void 0 && (missing0 = "identity")) {
        validate11.errors = [{ instancePath, schemaPath: "#/required", keyword: "required", params: { missingProperty: missing0 }, message: "must have required property '" + missing0 + "'" }];
        return false;
      } else {
        const _errs1 = errors;
        for (const key0 in data) {
          if (!(key0 === "egress" || key0 === "identity")) {
            validate11.errors = [{ instancePath, schemaPath: "#/additionalProperties", keyword: "additionalProperties", params: { additionalProperty: key0 }, message: "must NOT have additional properties" }];
            return false;
            break;
          }
        }
        if (_errs1 === errors) {
          if (data.egress !== void 0) {
            let data0 = data.egress;
            const _errs2 = errors;
            const _errs4 = errors;
            let valid2 = false;
            let passing0 = null;
            const _errs5 = errors;
            if (errors === _errs5) {
              if (data0 && typeof data0 == "object" && !Array.isArray(data0)) {
                let missing1;
                if (data0.mode === void 0 && (missing1 = "mode")) {
                  const err0 = { instancePath: instancePath + "/egress", schemaPath: "#/definitions/Egress/oneOf/0/required", keyword: "required", params: { missingProperty: missing1 }, message: "must have required property '" + missing1 + "'" };
                  if (vErrors === null) {
                    vErrors = [err0];
                  } else {
                    vErrors.push(err0);
                  }
                  errors++;
                } else {
                  const _errs7 = errors;
                  for (const key1 in data0) {
                    if (!(key1 === "mode")) {
                      const err1 = { instancePath: instancePath + "/egress", schemaPath: "#/definitions/Egress/oneOf/0/additionalProperties", keyword: "additionalProperties", params: { additionalProperty: key1 }, message: "must NOT have additional properties" };
                      if (vErrors === null) {
                        vErrors = [err1];
                      } else {
                        vErrors.push(err1);
                      }
                      errors++;
                      break;
                    }
                  }
                  if (_errs7 === errors) {
                    if (data0.mode !== void 0) {
                      let data1 = data0.mode;
                      if (typeof data1 !== "string") {
                        const err2 = { instancePath: instancePath + "/egress/mode", schemaPath: "#/definitions/Egress/oneOf/0/properties/mode/type", keyword: "type", params: { type: "string" }, message: "must be string" };
                        if (vErrors === null) {
                          vErrors = [err2];
                        } else {
                          vErrors.push(err2);
                        }
                        errors++;
                      }
                      if ("direct" !== data1) {
                        const err3 = { instancePath: instancePath + "/egress/mode", schemaPath: "#/definitions/Egress/oneOf/0/properties/mode/const", keyword: "const", params: { allowedValue: "direct" }, message: "must be equal to constant" };
                        if (vErrors === null) {
                          vErrors = [err3];
                        } else {
                          vErrors.push(err3);
                        }
                        errors++;
                      }
                    }
                  }
                }
              } else {
                const err4 = { instancePath: instancePath + "/egress", schemaPath: "#/definitions/Egress/oneOf/0/type", keyword: "type", params: { type: "object" }, message: "must be object" };
                if (vErrors === null) {
                  vErrors = [err4];
                } else {
                  vErrors.push(err4);
                }
                errors++;
              }
            }
            var _valid0 = _errs5 === errors;
            if (_valid0) {
              valid2 = true;
              passing0 = 0;
            }
            const _errs10 = errors;
            if (errors === _errs10) {
              if (data0 && typeof data0 == "object" && !Array.isArray(data0)) {
                let missing2;
                if (data0.mode === void 0 && (missing2 = "mode") || data0.url === void 0 && (missing2 = "url")) {
                  const err5 = { instancePath: instancePath + "/egress", schemaPath: "#/definitions/Egress/oneOf/1/required", keyword: "required", params: { missingProperty: missing2 }, message: "must have required property '" + missing2 + "'" };
                  if (vErrors === null) {
                    vErrors = [err5];
                  } else {
                    vErrors.push(err5);
                  }
                  errors++;
                } else {
                  const _errs12 = errors;
                  for (const key2 in data0) {
                    if (!(key2 === "mode" || key2 === "url")) {
                      const err6 = { instancePath: instancePath + "/egress", schemaPath: "#/definitions/Egress/oneOf/1/additionalProperties", keyword: "additionalProperties", params: { additionalProperty: key2 }, message: "must NOT have additional properties" };
                      if (vErrors === null) {
                        vErrors = [err6];
                      } else {
                        vErrors.push(err6);
                      }
                      errors++;
                      break;
                    }
                  }
                  if (_errs12 === errors) {
                    if (data0.mode !== void 0) {
                      let data2 = data0.mode;
                      const _errs13 = errors;
                      if (typeof data2 !== "string") {
                        const err7 = { instancePath: instancePath + "/egress/mode", schemaPath: "#/definitions/Egress/oneOf/1/properties/mode/type", keyword: "type", params: { type: "string" }, message: "must be string" };
                        if (vErrors === null) {
                          vErrors = [err7];
                        } else {
                          vErrors.push(err7);
                        }
                        errors++;
                      }
                      if ("proxy" !== data2) {
                        const err8 = { instancePath: instancePath + "/egress/mode", schemaPath: "#/definitions/Egress/oneOf/1/properties/mode/const", keyword: "const", params: { allowedValue: "proxy" }, message: "must be equal to constant" };
                        if (vErrors === null) {
                          vErrors = [err8];
                        } else {
                          vErrors.push(err8);
                        }
                        errors++;
                      }
                      var valid4 = _errs13 === errors;
                    } else {
                      var valid4 = true;
                    }
                    if (valid4) {
                      if (data0.url !== void 0) {
                        const _errs15 = errors;
                        if (typeof data0.url !== "string") {
                          const err9 = { instancePath: instancePath + "/egress/url", schemaPath: "#/definitions/Egress/oneOf/1/properties/url/type", keyword: "type", params: { type: "string" }, message: "must be string" };
                          if (vErrors === null) {
                            vErrors = [err9];
                          } else {
                            vErrors.push(err9);
                          }
                          errors++;
                        }
                        var valid4 = _errs15 === errors;
                      } else {
                        var valid4 = true;
                      }
                    }
                  }
                }
              } else {
                const err10 = { instancePath: instancePath + "/egress", schemaPath: "#/definitions/Egress/oneOf/1/type", keyword: "type", params: { type: "object" }, message: "must be object" };
                if (vErrors === null) {
                  vErrors = [err10];
                } else {
                  vErrors.push(err10);
                }
                errors++;
              }
            }
            var _valid0 = _errs10 === errors;
            if (_valid0 && valid2) {
              valid2 = false;
              passing0 = [passing0, 1];
            } else {
              if (_valid0) {
                valid2 = true;
                passing0 = 1;
              }
            }
            if (!valid2) {
              const err11 = { instancePath: instancePath + "/egress", schemaPath: "#/definitions/Egress/oneOf", keyword: "oneOf", params: { passingSchemas: passing0 }, message: "must match exactly one schema in oneOf" };
              if (vErrors === null) {
                vErrors = [err11];
              } else {
                vErrors.push(err11);
              }
              errors++;
              validate11.errors = vErrors;
              return false;
            } else {
              errors = _errs4;
              if (vErrors !== null) {
                if (_errs4) {
                  vErrors.length = _errs4;
                } else {
                  vErrors = null;
                }
              }
            }
            var valid0 = _errs2 === errors;
          } else {
            var valid0 = true;
          }
          if (valid0) {
            if (data.identity !== void 0) {
              let data4 = data.identity;
              const _errs17 = errors;
              const _errs18 = errors;
              if (errors === _errs18) {
                if (data4 && typeof data4 == "object" && !Array.isArray(data4)) {
                  let missing3;
                  if (data4.tlsProfile === void 0 && (missing3 = "tlsProfile") || data4.emulateHeaders === void 0 && (missing3 = "emulateHeaders")) {
                    validate11.errors = [{ instancePath: instancePath + "/identity", schemaPath: "#/definitions/BrowserIdentity/required", keyword: "required", params: { missingProperty: missing3 }, message: "must have required property '" + missing3 + "'" }];
                    return false;
                  } else {
                    const _errs20 = errors;
                    for (const key3 in data4) {
                      if (!(key3 === "emulateHeaders" || key3 === "tlsProfile" || key3 === "userAgent")) {
                        validate11.errors = [{ instancePath: instancePath + "/identity", schemaPath: "#/definitions/BrowserIdentity/additionalProperties", keyword: "additionalProperties", params: { additionalProperty: key3 }, message: "must NOT have additional properties" }];
                        return false;
                        break;
                      }
                    }
                    if (_errs20 === errors) {
                      if (data4.emulateHeaders !== void 0) {
                        const _errs21 = errors;
                        if (typeof data4.emulateHeaders !== "boolean") {
                          validate11.errors = [{ instancePath: instancePath + "/identity/emulateHeaders", schemaPath: "#/definitions/BrowserIdentity/properties/emulateHeaders/type", keyword: "type", params: { type: "boolean" }, message: "must be boolean" }];
                          return false;
                        }
                        var valid6 = _errs21 === errors;
                      } else {
                        var valid6 = true;
                      }
                      if (valid6) {
                        if (data4.tlsProfile !== void 0) {
                          const _errs23 = errors;
                          if (typeof data4.tlsProfile !== "string") {
                            validate11.errors = [{ instancePath: instancePath + "/identity/tlsProfile", schemaPath: "#/definitions/BrowserIdentity/properties/tlsProfile/type", keyword: "type", params: { type: "string" }, message: "must be string" }];
                            return false;
                          }
                          var valid6 = _errs23 === errors;
                        } else {
                          var valid6 = true;
                        }
                        if (valid6) {
                          if (data4.userAgent !== void 0) {
                            let data7 = data4.userAgent;
                            const _errs25 = errors;
                            if (typeof data7 !== "string" && data7 !== null) {
                              validate11.errors = [{ instancePath: instancePath + "/identity/userAgent", schemaPath: "#/definitions/BrowserIdentity/properties/userAgent/type", keyword: "type", params: { type: schema14.properties.userAgent.type }, message: "must be string,null" }];
                              return false;
                            }
                            var valid6 = _errs25 === errors;
                          } else {
                            var valid6 = true;
                          }
                        }
                      }
                    }
                  }
                } else {
                  validate11.errors = [{ instancePath: instancePath + "/identity", schemaPath: "#/definitions/BrowserIdentity/type", keyword: "type", params: { type: "object" }, message: "must be object" }];
                  return false;
                }
              }
              var valid0 = _errs17 === errors;
            } else {
              var valid0 = true;
            }
          }
        }
      }
    } else {
      validate11.errors = [{ instancePath, schemaPath: "#/type", keyword: "type", params: { type: "object" }, message: "must be object" }];
      return false;
    }
  }
  validate11.errors = vErrors;
  return errors === 0;
}
function validate10(data, { instancePath = "", parentData, parentDataProperty, rootData = data } = {}) {
  ;
  let vErrors = null;
  let errors = 0;
  if (errors === 0) {
    if (data && typeof data == "object" && !Array.isArray(data)) {
      let missing0;
      if (data.requestId === void 0 && (missing0 = "requestId") || data.partition === void 0 && (missing0 = "partition") || data.url === void 0 && (missing0 = "url") || data.method === void 0 && (missing0 = "method") || data.headers === void 0 && (missing0 = "headers") || data.hasBody === void 0 && (missing0 = "hasBody") || data.timeoutMs === void 0 && (missing0 = "timeoutMs") || data.maxResponseBytes === void 0 && (missing0 = "maxResponseBytes") || data.attempt === void 0 && (missing0 = "attempt")) {
        validate10.errors = [{ instancePath, schemaPath: "#/required", keyword: "required", params: { missingProperty: missing0 }, message: "must have required property '" + missing0 + "'" }];
        return false;
      } else {
        const _errs1 = errors;
        for (const key0 in data) {
          if (!func2.call(schema11.properties, key0)) {
            validate10.errors = [{ instancePath, schemaPath: "#/additionalProperties", keyword: "additionalProperties", params: { additionalProperty: key0 }, message: "must NOT have additional properties" }];
            return false;
            break;
          }
        }
        if (_errs1 === errors) {
          if (data.attempt !== void 0) {
            let data0 = data.attempt;
            const _errs2 = errors;
            if (!(typeof data0 == "number" && (!(data0 % 1) && !isNaN(data0)) && isFinite(data0))) {
              validate10.errors = [{ instancePath: instancePath + "/attempt", schemaPath: "#/properties/attempt/type", keyword: "type", params: { type: "integer" }, message: "must be integer" }];
              return false;
            }
            if (errors === _errs2) {
              if (typeof data0 == "number" && isFinite(data0)) {
                if (data0 > 9007199254740991 || isNaN(data0)) {
                  validate10.errors = [{ instancePath: instancePath + "/attempt", schemaPath: "#/properties/attempt/maximum", keyword: "maximum", params: { comparison: "<=", limit: 9007199254740991 }, message: "must be <= 9007199254740991" }];
                  return false;
                } else {
                  if (data0 < 0 || isNaN(data0)) {
                    validate10.errors = [{ instancePath: instancePath + "/attempt", schemaPath: "#/properties/attempt/minimum", keyword: "minimum", params: { comparison: ">=", limit: 0 }, message: "must be >= 0" }];
                    return false;
                  }
                }
              }
            }
            var valid0 = _errs2 === errors;
          } else {
            var valid0 = true;
          }
          if (valid0) {
            if (data.bodyLength !== void 0) {
              let data1 = data.bodyLength;
              const _errs4 = errors;
              if (!(typeof data1 == "number" && (!(data1 % 1) && !isNaN(data1)) && isFinite(data1)) && data1 !== null) {
                validate10.errors = [{ instancePath: instancePath + "/bodyLength", schemaPath: "#/properties/bodyLength/type", keyword: "type", params: { type: schema11.properties.bodyLength.type }, message: "must be integer,null" }];
                return false;
              }
              if (errors === _errs4) {
                if (typeof data1 == "number" && isFinite(data1)) {
                  if (data1 > 9007199254740991 || isNaN(data1)) {
                    validate10.errors = [{ instancePath: instancePath + "/bodyLength", schemaPath: "#/properties/bodyLength/maximum", keyword: "maximum", params: { comparison: "<=", limit: 9007199254740991 }, message: "must be <= 9007199254740991" }];
                    return false;
                  } else {
                    if (data1 < 0 || isNaN(data1)) {
                      validate10.errors = [{ instancePath: instancePath + "/bodyLength", schemaPath: "#/properties/bodyLength/minimum", keyword: "minimum", params: { comparison: ">=", limit: 0 }, message: "must be >= 0" }];
                      return false;
                    }
                  }
                }
              }
              var valid0 = _errs4 === errors;
            } else {
              var valid0 = true;
            }
            if (valid0) {
              if (data.connection !== void 0) {
                let data2 = data.connection;
                const _errs6 = errors;
                const _errs7 = errors;
                let valid1 = false;
                const _errs8 = errors;
                if (!validate11(data2, { instancePath: instancePath + "/connection", parentData: data, parentDataProperty: "connection", rootData })) {
                  vErrors = vErrors === null ? validate11.errors : vErrors.concat(validate11.errors);
                  errors = vErrors.length;
                }
                var _valid0 = _errs8 === errors;
                valid1 = valid1 || _valid0;
                if (!valid1) {
                  const _errs9 = errors;
                  if (data2 !== null) {
                    const err0 = { instancePath: instancePath + "/connection", schemaPath: "#/properties/connection/anyOf/1/type", keyword: "type", params: { type: "null" }, message: "must be null" };
                    if (vErrors === null) {
                      vErrors = [err0];
                    } else {
                      vErrors.push(err0);
                    }
                    errors++;
                  }
                  var _valid0 = _errs9 === errors;
                  valid1 = valid1 || _valid0;
                }
                if (!valid1) {
                  const err1 = { instancePath: instancePath + "/connection", schemaPath: "#/properties/connection/anyOf", keyword: "anyOf", params: {}, message: "must match a schema in anyOf" };
                  if (vErrors === null) {
                    vErrors = [err1];
                  } else {
                    vErrors.push(err1);
                  }
                  errors++;
                  validate10.errors = vErrors;
                  return false;
                } else {
                  errors = _errs7;
                  if (vErrors !== null) {
                    if (_errs7) {
                      vErrors.length = _errs7;
                    } else {
                      vErrors = null;
                    }
                  }
                }
                var valid0 = _errs6 === errors;
              } else {
                var valid0 = true;
              }
              if (valid0) {
                if (data.contextId !== void 0) {
                  let data3 = data.contextId;
                  const _errs11 = errors;
                  if (typeof data3 !== "string" && data3 !== null) {
                    validate10.errors = [{ instancePath: instancePath + "/contextId", schemaPath: "#/properties/contextId/type", keyword: "type", params: { type: schema11.properties.contextId.type }, message: "must be string,null" }];
                    return false;
                  }
                  var valid0 = _errs11 === errors;
                } else {
                  var valid0 = true;
                }
                if (valid0) {
                  if (data.hasBody !== void 0) {
                    const _errs13 = errors;
                    if (typeof data.hasBody !== "boolean") {
                      validate10.errors = [{ instancePath: instancePath + "/hasBody", schemaPath: "#/properties/hasBody/type", keyword: "type", params: { type: "boolean" }, message: "must be boolean" }];
                      return false;
                    }
                    var valid0 = _errs13 === errors;
                  } else {
                    var valid0 = true;
                  }
                  if (valid0) {
                    if (data.headers !== void 0) {
                      let data5 = data.headers;
                      const _errs15 = errors;
                      if (errors === _errs15) {
                        if (Array.isArray(data5)) {
                          var valid2 = true;
                          const len0 = data5.length;
                          for (let i0 = 0; i0 < len0; i0++) {
                            let data6 = data5[i0];
                            const _errs17 = errors;
                            if (errors === _errs17) {
                              if (Array.isArray(data6)) {
                                if (data6.length > 2) {
                                  validate10.errors = [{ instancePath: instancePath + "/headers/" + i0, schemaPath: "#/properties/headers/items/maxItems", keyword: "maxItems", params: { limit: 2 }, message: "must NOT have more than 2 items" }];
                                  return false;
                                } else {
                                  if (data6.length < 2) {
                                    validate10.errors = [{ instancePath: instancePath + "/headers/" + i0, schemaPath: "#/properties/headers/items/minItems", keyword: "minItems", params: { limit: 2 }, message: "must NOT have fewer than 2 items" }];
                                    return false;
                                  } else {
                                    const len1 = data6.length;
                                    if (len1 > 0) {
                                      const _errs19 = errors;
                                      if (typeof data6[0] !== "string") {
                                        validate10.errors = [{ instancePath: instancePath + "/headers/" + i0 + "/0", schemaPath: "#/properties/headers/items/items/0/type", keyword: "type", params: { type: "string" }, message: "must be string" }];
                                        return false;
                                      }
                                      var valid3 = _errs19 === errors;
                                    }
                                    if (valid3) {
                                      if (len1 > 1) {
                                        const _errs21 = errors;
                                        if (typeof data6[1] !== "string") {
                                          validate10.errors = [{ instancePath: instancePath + "/headers/" + i0 + "/1", schemaPath: "#/properties/headers/items/items/1/type", keyword: "type", params: { type: "string" }, message: "must be string" }];
                                          return false;
                                        }
                                        var valid3 = _errs21 === errors;
                                      }
                                    }
                                  }
                                }
                              } else {
                                validate10.errors = [{ instancePath: instancePath + "/headers/" + i0, schemaPath: "#/properties/headers/items/type", keyword: "type", params: { type: "array" }, message: "must be array" }];
                                return false;
                              }
                            }
                            var valid2 = _errs17 === errors;
                            if (!valid2) {
                              break;
                            }
                          }
                        } else {
                          validate10.errors = [{ instancePath: instancePath + "/headers", schemaPath: "#/properties/headers/type", keyword: "type", params: { type: "array" }, message: "must be array" }];
                          return false;
                        }
                      }
                      var valid0 = _errs15 === errors;
                    } else {
                      var valid0 = true;
                    }
                    if (valid0) {
                      if (data.maxResponseBytes !== void 0) {
                        let data9 = data.maxResponseBytes;
                        const _errs23 = errors;
                        if (!(typeof data9 == "number" && (!(data9 % 1) && !isNaN(data9)) && isFinite(data9))) {
                          validate10.errors = [{ instancePath: instancePath + "/maxResponseBytes", schemaPath: "#/properties/maxResponseBytes/type", keyword: "type", params: { type: "integer" }, message: "must be integer" }];
                          return false;
                        }
                        if (errors === _errs23) {
                          if (typeof data9 == "number" && isFinite(data9)) {
                            if (data9 > 9007199254740991 || isNaN(data9)) {
                              validate10.errors = [{ instancePath: instancePath + "/maxResponseBytes", schemaPath: "#/properties/maxResponseBytes/maximum", keyword: "maximum", params: { comparison: "<=", limit: 9007199254740991 }, message: "must be <= 9007199254740991" }];
                              return false;
                            } else {
                              if (data9 < 0 || isNaN(data9)) {
                                validate10.errors = [{ instancePath: instancePath + "/maxResponseBytes", schemaPath: "#/properties/maxResponseBytes/minimum", keyword: "minimum", params: { comparison: ">=", limit: 0 }, message: "must be >= 0" }];
                                return false;
                              }
                            }
                          }
                        }
                        var valid0 = _errs23 === errors;
                      } else {
                        var valid0 = true;
                      }
                      if (valid0) {
                        if (data.method !== void 0) {
                          const _errs25 = errors;
                          if (typeof data.method !== "string") {
                            validate10.errors = [{ instancePath: instancePath + "/method", schemaPath: "#/properties/method/type", keyword: "type", params: { type: "string" }, message: "must be string" }];
                            return false;
                          }
                          var valid0 = _errs25 === errors;
                        } else {
                          var valid0 = true;
                        }
                        if (valid0) {
                          if (data.partition !== void 0) {
                            const _errs27 = errors;
                            if (typeof data.partition !== "string") {
                              validate10.errors = [{ instancePath: instancePath + "/partition", schemaPath: "#/properties/partition/type", keyword: "type", params: { type: "string" }, message: "must be string" }];
                              return false;
                            }
                            var valid0 = _errs27 === errors;
                          } else {
                            var valid0 = true;
                          }
                          if (valid0) {
                            if (data.requestId !== void 0) {
                              const _errs29 = errors;
                              if (typeof data.requestId !== "string") {
                                validate10.errors = [{ instancePath: instancePath + "/requestId", schemaPath: "#/properties/requestId/type", keyword: "type", params: { type: "string" }, message: "must be string" }];
                                return false;
                              }
                              var valid0 = _errs29 === errors;
                            } else {
                              var valid0 = true;
                            }
                            if (valid0) {
                              if (data.timeoutMs !== void 0) {
                                let data13 = data.timeoutMs;
                                const _errs31 = errors;
                                if (!(typeof data13 == "number" && (!(data13 % 1) && !isNaN(data13)) && isFinite(data13))) {
                                  validate10.errors = [{ instancePath: instancePath + "/timeoutMs", schemaPath: "#/properties/timeoutMs/type", keyword: "type", params: { type: "integer" }, message: "must be integer" }];
                                  return false;
                                }
                                if (errors === _errs31) {
                                  if (typeof data13 == "number" && isFinite(data13)) {
                                    if (data13 > 9007199254740991 || isNaN(data13)) {
                                      validate10.errors = [{ instancePath: instancePath + "/timeoutMs", schemaPath: "#/properties/timeoutMs/maximum", keyword: "maximum", params: { comparison: "<=", limit: 9007199254740991 }, message: "must be <= 9007199254740991" }];
                                      return false;
                                    } else {
                                      if (data13 < 0 || isNaN(data13)) {
                                        validate10.errors = [{ instancePath: instancePath + "/timeoutMs", schemaPath: "#/properties/timeoutMs/minimum", keyword: "minimum", params: { comparison: ">=", limit: 0 }, message: "must be >= 0" }];
                                        return false;
                                      }
                                    }
                                  }
                                }
                                var valid0 = _errs31 === errors;
                              } else {
                                var valid0 = true;
                              }
                              if (valid0) {
                                if (data.url !== void 0) {
                                  const _errs33 = errors;
                                  if (typeof data.url !== "string") {
                                    validate10.errors = [{ instancePath: instancePath + "/url", schemaPath: "#/properties/url/type", keyword: "type", params: { type: "string" }, message: "must be string" }];
                                    return false;
                                  }
                                  var valid0 = _errs33 === errors;
                                } else {
                                  var valid0 = true;
                                }
                              }
                            }
                          }
                        }
                      }
                    }
                  }
                }
              }
            }
          }
        }
      }
    } else {
      validate10.errors = [{ instancePath, schemaPath: "#/type", keyword: "type", params: { type: "object" }, message: "must be object" }];
      return false;
    }
  }
  validate10.errors = vErrors;
  return errors === 0;
}
var responseMetadata = validate13;
var schema15 = { "$id": "https://ja3proxy.invalid/contracts/responseMetadata.schema.json", "$schema": "http://json-schema.org/draft-07/schema#", "definitions": { "Delivery": { "enum": ["not_started", "possibly_sent", "response_started"], "type": "string" }, "Diagnostics": { "properties": { "attempt": { "format": "uint64", "minimum": 0, "type": "integer", "maximum": 9007199254740991 }, "bodyMs": { "format": "uint64", "minimum": 0, "type": ["integer", "null"], "maximum": 9007199254740991 }, "clientReused": { "type": ["boolean", "null"] }, "contextId": { "type": ["string", "null"] }, "cookieRevision": { "format": "uint64", "minimum": 0, "type": ["integer", "null"], "maximum": 9007199254740991 }, "delivery": { "$ref": "#/definitions/Delivery" }, "headersMs": { "format": "uint64", "minimum": 0, "type": ["integer", "null"], "maximum": 9007199254740991 }, "phase": { "$ref": "#/definitions/Phase" }, "queueMs": { "format": "uint64", "minimum": 0, "type": "integer", "maximum": 9007199254740991 }, "requestBytes": { "format": "uint64", "minimum": 0, "type": "integer", "maximum": 9007199254740991 }, "requestId": { "type": "string" }, "responseBytes": { "format": "uint64", "minimum": 0, "type": "integer", "maximum": 9007199254740991 }, "tlsProfile": { "type": "string" }, "totalMs": { "format": "uint64", "minimum": 0, "type": "integer", "maximum": 9007199254740991 }, "traceId": { "type": ["string", "null"] } }, "required": ["requestId", "attempt", "phase", "delivery", "queueMs", "headersMs", "bodyMs", "totalMs", "requestBytes", "responseBytes", "tlsProfile"], "type": "object" }, "Phase": { "enum": ["queued", "preparing", "upstream", "body", "complete"], "type": "string" } }, "properties": { "cookieRevision": { "format": "uint64", "minimum": 0, "type": ["integer", "null"], "maximum": 9007199254740991 }, "diagnostics": { "$ref": "#/definitions/Diagnostics" }, "headers": { "items": { "items": [{ "type": "string" }, { "type": "string" }], "maxItems": 2, "minItems": 2, "type": "array" }, "type": "array" }, "requestId": { "type": "string" }, "status": { "format": "uint16", "maximum": 65535, "minimum": 0, "type": "integer" } }, "required": ["requestId", "status", "headers", "diagnostics"], "title": "ResponseMetadata", "type": "object" };
var schema16 = { "properties": { "attempt": { "format": "uint64", "minimum": 0, "type": "integer", "maximum": 9007199254740991 }, "bodyMs": { "format": "uint64", "minimum": 0, "type": ["integer", "null"], "maximum": 9007199254740991 }, "clientReused": { "type": ["boolean", "null"] }, "contextId": { "type": ["string", "null"] }, "cookieRevision": { "format": "uint64", "minimum": 0, "type": ["integer", "null"], "maximum": 9007199254740991 }, "delivery": { "$ref": "#/definitions/Delivery" }, "headersMs": { "format": "uint64", "minimum": 0, "type": ["integer", "null"], "maximum": 9007199254740991 }, "phase": { "$ref": "#/definitions/Phase" }, "queueMs": { "format": "uint64", "minimum": 0, "type": "integer", "maximum": 9007199254740991 }, "requestBytes": { "format": "uint64", "minimum": 0, "type": "integer", "maximum": 9007199254740991 }, "requestId": { "type": "string" }, "responseBytes": { "format": "uint64", "minimum": 0, "type": "integer", "maximum": 9007199254740991 }, "tlsProfile": { "type": "string" }, "totalMs": { "format": "uint64", "minimum": 0, "type": "integer", "maximum": 9007199254740991 }, "traceId": { "type": ["string", "null"] } }, "required": ["requestId", "attempt", "phase", "delivery", "queueMs", "headersMs", "bodyMs", "totalMs", "requestBytes", "responseBytes", "tlsProfile"], "type": "object" };
var schema17 = { "enum": ["not_started", "possibly_sent", "response_started"], "type": "string" };
var schema18 = { "enum": ["queued", "preparing", "upstream", "body", "complete"], "type": "string" };
function validate14(data, { instancePath = "", parentData, parentDataProperty, rootData = data } = {}) {
  let vErrors = null;
  let errors = 0;
  if (errors === 0) {
    if (data && typeof data == "object" && !Array.isArray(data)) {
      let missing0;
      if (data.requestId === void 0 && (missing0 = "requestId") || data.attempt === void 0 && (missing0 = "attempt") || data.phase === void 0 && (missing0 = "phase") || data.delivery === void 0 && (missing0 = "delivery") || data.queueMs === void 0 && (missing0 = "queueMs") || data.headersMs === void 0 && (missing0 = "headersMs") || data.bodyMs === void 0 && (missing0 = "bodyMs") || data.totalMs === void 0 && (missing0 = "totalMs") || data.requestBytes === void 0 && (missing0 = "requestBytes") || data.responseBytes === void 0 && (missing0 = "responseBytes") || data.tlsProfile === void 0 && (missing0 = "tlsProfile")) {
        validate14.errors = [{ instancePath, schemaPath: "#/required", keyword: "required", params: { missingProperty: missing0 }, message: "must have required property '" + missing0 + "'" }];
        return false;
      } else {
        if (data.attempt !== void 0) {
          let data0 = data.attempt;
          const _errs1 = errors;
          if (!(typeof data0 == "number" && (!(data0 % 1) && !isNaN(data0)) && isFinite(data0))) {
            validate14.errors = [{ instancePath: instancePath + "/attempt", schemaPath: "#/properties/attempt/type", keyword: "type", params: { type: "integer" }, message: "must be integer" }];
            return false;
          }
          if (errors === _errs1) {
            if (typeof data0 == "number" && isFinite(data0)) {
              if (data0 > 9007199254740991 || isNaN(data0)) {
                validate14.errors = [{ instancePath: instancePath + "/attempt", schemaPath: "#/properties/attempt/maximum", keyword: "maximum", params: { comparison: "<=", limit: 9007199254740991 }, message: "must be <= 9007199254740991" }];
                return false;
              } else {
                if (data0 < 0 || isNaN(data0)) {
                  validate14.errors = [{ instancePath: instancePath + "/attempt", schemaPath: "#/properties/attempt/minimum", keyword: "minimum", params: { comparison: ">=", limit: 0 }, message: "must be >= 0" }];
                  return false;
                }
              }
            }
          }
          var valid0 = _errs1 === errors;
        } else {
          var valid0 = true;
        }
        if (valid0) {
          if (data.bodyMs !== void 0) {
            let data1 = data.bodyMs;
            const _errs3 = errors;
            if (!(typeof data1 == "number" && (!(data1 % 1) && !isNaN(data1)) && isFinite(data1)) && data1 !== null) {
              validate14.errors = [{ instancePath: instancePath + "/bodyMs", schemaPath: "#/properties/bodyMs/type", keyword: "type", params: { type: schema16.properties.bodyMs.type }, message: "must be integer,null" }];
              return false;
            }
            if (errors === _errs3) {
              if (typeof data1 == "number" && isFinite(data1)) {
                if (data1 > 9007199254740991 || isNaN(data1)) {
                  validate14.errors = [{ instancePath: instancePath + "/bodyMs", schemaPath: "#/properties/bodyMs/maximum", keyword: "maximum", params: { comparison: "<=", limit: 9007199254740991 }, message: "must be <= 9007199254740991" }];
                  return false;
                } else {
                  if (data1 < 0 || isNaN(data1)) {
                    validate14.errors = [{ instancePath: instancePath + "/bodyMs", schemaPath: "#/properties/bodyMs/minimum", keyword: "minimum", params: { comparison: ">=", limit: 0 }, message: "must be >= 0" }];
                    return false;
                  }
                }
              }
            }
            var valid0 = _errs3 === errors;
          } else {
            var valid0 = true;
          }
          if (valid0) {
            if (data.clientReused !== void 0) {
              let data2 = data.clientReused;
              const _errs5 = errors;
              if (typeof data2 !== "boolean" && data2 !== null) {
                validate14.errors = [{ instancePath: instancePath + "/clientReused", schemaPath: "#/properties/clientReused/type", keyword: "type", params: { type: schema16.properties.clientReused.type }, message: "must be boolean,null" }];
                return false;
              }
              var valid0 = _errs5 === errors;
            } else {
              var valid0 = true;
            }
            if (valid0) {
              if (data.contextId !== void 0) {
                let data3 = data.contextId;
                const _errs7 = errors;
                if (typeof data3 !== "string" && data3 !== null) {
                  validate14.errors = [{ instancePath: instancePath + "/contextId", schemaPath: "#/properties/contextId/type", keyword: "type", params: { type: schema16.properties.contextId.type }, message: "must be string,null" }];
                  return false;
                }
                var valid0 = _errs7 === errors;
              } else {
                var valid0 = true;
              }
              if (valid0) {
                if (data.cookieRevision !== void 0) {
                  let data4 = data.cookieRevision;
                  const _errs9 = errors;
                  if (!(typeof data4 == "number" && (!(data4 % 1) && !isNaN(data4)) && isFinite(data4)) && data4 !== null) {
                    validate14.errors = [{ instancePath: instancePath + "/cookieRevision", schemaPath: "#/properties/cookieRevision/type", keyword: "type", params: { type: schema16.properties.cookieRevision.type }, message: "must be integer,null" }];
                    return false;
                  }
                  if (errors === _errs9) {
                    if (typeof data4 == "number" && isFinite(data4)) {
                      if (data4 > 9007199254740991 || isNaN(data4)) {
                        validate14.errors = [{ instancePath: instancePath + "/cookieRevision", schemaPath: "#/properties/cookieRevision/maximum", keyword: "maximum", params: { comparison: "<=", limit: 9007199254740991 }, message: "must be <= 9007199254740991" }];
                        return false;
                      } else {
                        if (data4 < 0 || isNaN(data4)) {
                          validate14.errors = [{ instancePath: instancePath + "/cookieRevision", schemaPath: "#/properties/cookieRevision/minimum", keyword: "minimum", params: { comparison: ">=", limit: 0 }, message: "must be >= 0" }];
                          return false;
                        }
                      }
                    }
                  }
                  var valid0 = _errs9 === errors;
                } else {
                  var valid0 = true;
                }
                if (valid0) {
                  if (data.delivery !== void 0) {
                    let data5 = data.delivery;
                    const _errs11 = errors;
                    if (typeof data5 !== "string") {
                      validate14.errors = [{ instancePath: instancePath + "/delivery", schemaPath: "#/definitions/Delivery/type", keyword: "type", params: { type: "string" }, message: "must be string" }];
                      return false;
                    }
                    if (!(data5 === "not_started" || data5 === "possibly_sent" || data5 === "response_started")) {
                      validate14.errors = [{ instancePath: instancePath + "/delivery", schemaPath: "#/definitions/Delivery/enum", keyword: "enum", params: { allowedValues: schema17.enum }, message: "must be equal to one of the allowed values" }];
                      return false;
                    }
                    var valid0 = _errs11 === errors;
                  } else {
                    var valid0 = true;
                  }
                  if (valid0) {
                    if (data.headersMs !== void 0) {
                      let data6 = data.headersMs;
                      const _errs14 = errors;
                      if (!(typeof data6 == "number" && (!(data6 % 1) && !isNaN(data6)) && isFinite(data6)) && data6 !== null) {
                        validate14.errors = [{ instancePath: instancePath + "/headersMs", schemaPath: "#/properties/headersMs/type", keyword: "type", params: { type: schema16.properties.headersMs.type }, message: "must be integer,null" }];
                        return false;
                      }
                      if (errors === _errs14) {
                        if (typeof data6 == "number" && isFinite(data6)) {
                          if (data6 > 9007199254740991 || isNaN(data6)) {
                            validate14.errors = [{ instancePath: instancePath + "/headersMs", schemaPath: "#/properties/headersMs/maximum", keyword: "maximum", params: { comparison: "<=", limit: 9007199254740991 }, message: "must be <= 9007199254740991" }];
                            return false;
                          } else {
                            if (data6 < 0 || isNaN(data6)) {
                              validate14.errors = [{ instancePath: instancePath + "/headersMs", schemaPath: "#/properties/headersMs/minimum", keyword: "minimum", params: { comparison: ">=", limit: 0 }, message: "must be >= 0" }];
                              return false;
                            }
                          }
                        }
                      }
                      var valid0 = _errs14 === errors;
                    } else {
                      var valid0 = true;
                    }
                    if (valid0) {
                      if (data.phase !== void 0) {
                        let data7 = data.phase;
                        const _errs16 = errors;
                        if (typeof data7 !== "string") {
                          validate14.errors = [{ instancePath: instancePath + "/phase", schemaPath: "#/definitions/Phase/type", keyword: "type", params: { type: "string" }, message: "must be string" }];
                          return false;
                        }
                        if (!(data7 === "queued" || data7 === "preparing" || data7 === "upstream" || data7 === "body" || data7 === "complete")) {
                          validate14.errors = [{ instancePath: instancePath + "/phase", schemaPath: "#/definitions/Phase/enum", keyword: "enum", params: { allowedValues: schema18.enum }, message: "must be equal to one of the allowed values" }];
                          return false;
                        }
                        var valid0 = _errs16 === errors;
                      } else {
                        var valid0 = true;
                      }
                      if (valid0) {
                        if (data.queueMs !== void 0) {
                          let data8 = data.queueMs;
                          const _errs19 = errors;
                          if (!(typeof data8 == "number" && (!(data8 % 1) && !isNaN(data8)) && isFinite(data8))) {
                            validate14.errors = [{ instancePath: instancePath + "/queueMs", schemaPath: "#/properties/queueMs/type", keyword: "type", params: { type: "integer" }, message: "must be integer" }];
                            return false;
                          }
                          if (errors === _errs19) {
                            if (typeof data8 == "number" && isFinite(data8)) {
                              if (data8 > 9007199254740991 || isNaN(data8)) {
                                validate14.errors = [{ instancePath: instancePath + "/queueMs", schemaPath: "#/properties/queueMs/maximum", keyword: "maximum", params: { comparison: "<=", limit: 9007199254740991 }, message: "must be <= 9007199254740991" }];
                                return false;
                              } else {
                                if (data8 < 0 || isNaN(data8)) {
                                  validate14.errors = [{ instancePath: instancePath + "/queueMs", schemaPath: "#/properties/queueMs/minimum", keyword: "minimum", params: { comparison: ">=", limit: 0 }, message: "must be >= 0" }];
                                  return false;
                                }
                              }
                            }
                          }
                          var valid0 = _errs19 === errors;
                        } else {
                          var valid0 = true;
                        }
                        if (valid0) {
                          if (data.requestBytes !== void 0) {
                            let data9 = data.requestBytes;
                            const _errs21 = errors;
                            if (!(typeof data9 == "number" && (!(data9 % 1) && !isNaN(data9)) && isFinite(data9))) {
                              validate14.errors = [{ instancePath: instancePath + "/requestBytes", schemaPath: "#/properties/requestBytes/type", keyword: "type", params: { type: "integer" }, message: "must be integer" }];
                              return false;
                            }
                            if (errors === _errs21) {
                              if (typeof data9 == "number" && isFinite(data9)) {
                                if (data9 > 9007199254740991 || isNaN(data9)) {
                                  validate14.errors = [{ instancePath: instancePath + "/requestBytes", schemaPath: "#/properties/requestBytes/maximum", keyword: "maximum", params: { comparison: "<=", limit: 9007199254740991 }, message: "must be <= 9007199254740991" }];
                                  return false;
                                } else {
                                  if (data9 < 0 || isNaN(data9)) {
                                    validate14.errors = [{ instancePath: instancePath + "/requestBytes", schemaPath: "#/properties/requestBytes/minimum", keyword: "minimum", params: { comparison: ">=", limit: 0 }, message: "must be >= 0" }];
                                    return false;
                                  }
                                }
                              }
                            }
                            var valid0 = _errs21 === errors;
                          } else {
                            var valid0 = true;
                          }
                          if (valid0) {
                            if (data.requestId !== void 0) {
                              const _errs23 = errors;
                              if (typeof data.requestId !== "string") {
                                validate14.errors = [{ instancePath: instancePath + "/requestId", schemaPath: "#/properties/requestId/type", keyword: "type", params: { type: "string" }, message: "must be string" }];
                                return false;
                              }
                              var valid0 = _errs23 === errors;
                            } else {
                              var valid0 = true;
                            }
                            if (valid0) {
                              if (data.responseBytes !== void 0) {
                                let data11 = data.responseBytes;
                                const _errs25 = errors;
                                if (!(typeof data11 == "number" && (!(data11 % 1) && !isNaN(data11)) && isFinite(data11))) {
                                  validate14.errors = [{ instancePath: instancePath + "/responseBytes", schemaPath: "#/properties/responseBytes/type", keyword: "type", params: { type: "integer" }, message: "must be integer" }];
                                  return false;
                                }
                                if (errors === _errs25) {
                                  if (typeof data11 == "number" && isFinite(data11)) {
                                    if (data11 > 9007199254740991 || isNaN(data11)) {
                                      validate14.errors = [{ instancePath: instancePath + "/responseBytes", schemaPath: "#/properties/responseBytes/maximum", keyword: "maximum", params: { comparison: "<=", limit: 9007199254740991 }, message: "must be <= 9007199254740991" }];
                                      return false;
                                    } else {
                                      if (data11 < 0 || isNaN(data11)) {
                                        validate14.errors = [{ instancePath: instancePath + "/responseBytes", schemaPath: "#/properties/responseBytes/minimum", keyword: "minimum", params: { comparison: ">=", limit: 0 }, message: "must be >= 0" }];
                                        return false;
                                      }
                                    }
                                  }
                                }
                                var valid0 = _errs25 === errors;
                              } else {
                                var valid0 = true;
                              }
                              if (valid0) {
                                if (data.tlsProfile !== void 0) {
                                  const _errs27 = errors;
                                  if (typeof data.tlsProfile !== "string") {
                                    validate14.errors = [{ instancePath: instancePath + "/tlsProfile", schemaPath: "#/properties/tlsProfile/type", keyword: "type", params: { type: "string" }, message: "must be string" }];
                                    return false;
                                  }
                                  var valid0 = _errs27 === errors;
                                } else {
                                  var valid0 = true;
                                }
                                if (valid0) {
                                  if (data.totalMs !== void 0) {
                                    let data13 = data.totalMs;
                                    const _errs29 = errors;
                                    if (!(typeof data13 == "number" && (!(data13 % 1) && !isNaN(data13)) && isFinite(data13))) {
                                      validate14.errors = [{ instancePath: instancePath + "/totalMs", schemaPath: "#/properties/totalMs/type", keyword: "type", params: { type: "integer" }, message: "must be integer" }];
                                      return false;
                                    }
                                    if (errors === _errs29) {
                                      if (typeof data13 == "number" && isFinite(data13)) {
                                        if (data13 > 9007199254740991 || isNaN(data13)) {
                                          validate14.errors = [{ instancePath: instancePath + "/totalMs", schemaPath: "#/properties/totalMs/maximum", keyword: "maximum", params: { comparison: "<=", limit: 9007199254740991 }, message: "must be <= 9007199254740991" }];
                                          return false;
                                        } else {
                                          if (data13 < 0 || isNaN(data13)) {
                                            validate14.errors = [{ instancePath: instancePath + "/totalMs", schemaPath: "#/properties/totalMs/minimum", keyword: "minimum", params: { comparison: ">=", limit: 0 }, message: "must be >= 0" }];
                                            return false;
                                          }
                                        }
                                      }
                                    }
                                    var valid0 = _errs29 === errors;
                                  } else {
                                    var valid0 = true;
                                  }
                                  if (valid0) {
                                    if (data.traceId !== void 0) {
                                      let data14 = data.traceId;
                                      const _errs31 = errors;
                                      if (typeof data14 !== "string" && data14 !== null) {
                                        validate14.errors = [{ instancePath: instancePath + "/traceId", schemaPath: "#/properties/traceId/type", keyword: "type", params: { type: schema16.properties.traceId.type }, message: "must be string,null" }];
                                        return false;
                                      }
                                      var valid0 = _errs31 === errors;
                                    } else {
                                      var valid0 = true;
                                    }
                                  }
                                }
                              }
                            }
                          }
                        }
                      }
                    }
                  }
                }
              }
            }
          }
        }
      }
    } else {
      validate14.errors = [{ instancePath, schemaPath: "#/type", keyword: "type", params: { type: "object" }, message: "must be object" }];
      return false;
    }
  }
  validate14.errors = vErrors;
  return errors === 0;
}
function validate13(data, { instancePath = "", parentData, parentDataProperty, rootData = data } = {}) {
  ;
  let vErrors = null;
  let errors = 0;
  if (errors === 0) {
    if (data && typeof data == "object" && !Array.isArray(data)) {
      let missing0;
      if (data.requestId === void 0 && (missing0 = "requestId") || data.status === void 0 && (missing0 = "status") || data.headers === void 0 && (missing0 = "headers") || data.diagnostics === void 0 && (missing0 = "diagnostics")) {
        validate13.errors = [{ instancePath, schemaPath: "#/required", keyword: "required", params: { missingProperty: missing0 }, message: "must have required property '" + missing0 + "'" }];
        return false;
      } else {
        if (data.cookieRevision !== void 0) {
          let data0 = data.cookieRevision;
          const _errs1 = errors;
          if (!(typeof data0 == "number" && (!(data0 % 1) && !isNaN(data0)) && isFinite(data0)) && data0 !== null) {
            validate13.errors = [{ instancePath: instancePath + "/cookieRevision", schemaPath: "#/properties/cookieRevision/type", keyword: "type", params: { type: schema15.properties.cookieRevision.type }, message: "must be integer,null" }];
            return false;
          }
          if (errors === _errs1) {
            if (typeof data0 == "number" && isFinite(data0)) {
              if (data0 > 9007199254740991 || isNaN(data0)) {
                validate13.errors = [{ instancePath: instancePath + "/cookieRevision", schemaPath: "#/properties/cookieRevision/maximum", keyword: "maximum", params: { comparison: "<=", limit: 9007199254740991 }, message: "must be <= 9007199254740991" }];
                return false;
              } else {
                if (data0 < 0 || isNaN(data0)) {
                  validate13.errors = [{ instancePath: instancePath + "/cookieRevision", schemaPath: "#/properties/cookieRevision/minimum", keyword: "minimum", params: { comparison: ">=", limit: 0 }, message: "must be >= 0" }];
                  return false;
                }
              }
            }
          }
          var valid0 = _errs1 === errors;
        } else {
          var valid0 = true;
        }
        if (valid0) {
          if (data.diagnostics !== void 0) {
            const _errs3 = errors;
            if (!validate14(data.diagnostics, { instancePath: instancePath + "/diagnostics", parentData: data, parentDataProperty: "diagnostics", rootData })) {
              vErrors = vErrors === null ? validate14.errors : vErrors.concat(validate14.errors);
              errors = vErrors.length;
            }
            var valid0 = _errs3 === errors;
          } else {
            var valid0 = true;
          }
          if (valid0) {
            if (data.headers !== void 0) {
              let data2 = data.headers;
              const _errs4 = errors;
              if (errors === _errs4) {
                if (Array.isArray(data2)) {
                  var valid1 = true;
                  const len0 = data2.length;
                  for (let i0 = 0; i0 < len0; i0++) {
                    let data3 = data2[i0];
                    const _errs6 = errors;
                    if (errors === _errs6) {
                      if (Array.isArray(data3)) {
                        if (data3.length > 2) {
                          validate13.errors = [{ instancePath: instancePath + "/headers/" + i0, schemaPath: "#/properties/headers/items/maxItems", keyword: "maxItems", params: { limit: 2 }, message: "must NOT have more than 2 items" }];
                          return false;
                        } else {
                          if (data3.length < 2) {
                            validate13.errors = [{ instancePath: instancePath + "/headers/" + i0, schemaPath: "#/properties/headers/items/minItems", keyword: "minItems", params: { limit: 2 }, message: "must NOT have fewer than 2 items" }];
                            return false;
                          } else {
                            const len1 = data3.length;
                            if (len1 > 0) {
                              const _errs8 = errors;
                              if (typeof data3[0] !== "string") {
                                validate13.errors = [{ instancePath: instancePath + "/headers/" + i0 + "/0", schemaPath: "#/properties/headers/items/items/0/type", keyword: "type", params: { type: "string" }, message: "must be string" }];
                                return false;
                              }
                              var valid2 = _errs8 === errors;
                            }
                            if (valid2) {
                              if (len1 > 1) {
                                const _errs10 = errors;
                                if (typeof data3[1] !== "string") {
                                  validate13.errors = [{ instancePath: instancePath + "/headers/" + i0 + "/1", schemaPath: "#/properties/headers/items/items/1/type", keyword: "type", params: { type: "string" }, message: "must be string" }];
                                  return false;
                                }
                                var valid2 = _errs10 === errors;
                              }
                            }
                          }
                        }
                      } else {
                        validate13.errors = [{ instancePath: instancePath + "/headers/" + i0, schemaPath: "#/properties/headers/items/type", keyword: "type", params: { type: "array" }, message: "must be array" }];
                        return false;
                      }
                    }
                    var valid1 = _errs6 === errors;
                    if (!valid1) {
                      break;
                    }
                  }
                } else {
                  validate13.errors = [{ instancePath: instancePath + "/headers", schemaPath: "#/properties/headers/type", keyword: "type", params: { type: "array" }, message: "must be array" }];
                  return false;
                }
              }
              var valid0 = _errs4 === errors;
            } else {
              var valid0 = true;
            }
            if (valid0) {
              if (data.requestId !== void 0) {
                const _errs12 = errors;
                if (typeof data.requestId !== "string") {
                  validate13.errors = [{ instancePath: instancePath + "/requestId", schemaPath: "#/properties/requestId/type", keyword: "type", params: { type: "string" }, message: "must be string" }];
                  return false;
                }
                var valid0 = _errs12 === errors;
              } else {
                var valid0 = true;
              }
              if (valid0) {
                if (data.status !== void 0) {
                  let data7 = data.status;
                  const _errs14 = errors;
                  if (!(typeof data7 == "number" && (!(data7 % 1) && !isNaN(data7)) && isFinite(data7))) {
                    validate13.errors = [{ instancePath: instancePath + "/status", schemaPath: "#/properties/status/type", keyword: "type", params: { type: "integer" }, message: "must be integer" }];
                    return false;
                  }
                  if (errors === _errs14) {
                    if (typeof data7 == "number" && isFinite(data7)) {
                      if (data7 > 65535 || isNaN(data7)) {
                        validate13.errors = [{ instancePath: instancePath + "/status", schemaPath: "#/properties/status/maximum", keyword: "maximum", params: { comparison: "<=", limit: 65535 }, message: "must be <= 65535" }];
                        return false;
                      } else {
                        if (data7 < 0 || isNaN(data7)) {
                          validate13.errors = [{ instancePath: instancePath + "/status", schemaPath: "#/properties/status/minimum", keyword: "minimum", params: { comparison: ">=", limit: 0 }, message: "must be >= 0" }];
                          return false;
                        }
                      }
                    }
                  }
                  var valid0 = _errs14 === errors;
                } else {
                  var valid0 = true;
                }
              }
            }
          }
        }
      }
    } else {
      validate13.errors = [{ instancePath, schemaPath: "#/type", keyword: "type", params: { type: "object" }, message: "must be object" }];
      return false;
    }
  }
  validate13.errors = vErrors;
  return errors === 0;
}
var diagnostics = validate16;
var schema19 = { "$id": "https://ja3proxy.invalid/contracts/diagnostics.schema.json", "$schema": "http://json-schema.org/draft-07/schema#", "definitions": { "Delivery": { "enum": ["not_started", "possibly_sent", "response_started"], "type": "string" }, "Phase": { "enum": ["queued", "preparing", "upstream", "body", "complete"], "type": "string" } }, "properties": { "attempt": { "format": "uint64", "minimum": 0, "type": "integer", "maximum": 9007199254740991 }, "bodyMs": { "format": "uint64", "minimum": 0, "type": ["integer", "null"], "maximum": 9007199254740991 }, "clientReused": { "type": ["boolean", "null"] }, "contextId": { "type": ["string", "null"] }, "cookieRevision": { "format": "uint64", "minimum": 0, "type": ["integer", "null"], "maximum": 9007199254740991 }, "delivery": { "$ref": "#/definitions/Delivery" }, "headersMs": { "format": "uint64", "minimum": 0, "type": ["integer", "null"], "maximum": 9007199254740991 }, "phase": { "$ref": "#/definitions/Phase" }, "queueMs": { "format": "uint64", "minimum": 0, "type": "integer", "maximum": 9007199254740991 }, "requestBytes": { "format": "uint64", "minimum": 0, "type": "integer", "maximum": 9007199254740991 }, "requestId": { "type": "string" }, "responseBytes": { "format": "uint64", "minimum": 0, "type": "integer", "maximum": 9007199254740991 }, "tlsProfile": { "type": "string" }, "totalMs": { "format": "uint64", "minimum": 0, "type": "integer", "maximum": 9007199254740991 }, "traceId": { "type": ["string", "null"] } }, "required": ["requestId", "attempt", "phase", "delivery", "queueMs", "headersMs", "bodyMs", "totalMs", "requestBytes", "responseBytes", "tlsProfile"], "title": "Diagnostics", "type": "object" };
var schema20 = { "enum": ["not_started", "possibly_sent", "response_started"], "type": "string" };
var schema21 = { "enum": ["queued", "preparing", "upstream", "body", "complete"], "type": "string" };
function validate16(data, { instancePath = "", parentData, parentDataProperty, rootData = data } = {}) {
  ;
  let vErrors = null;
  let errors = 0;
  if (errors === 0) {
    if (data && typeof data == "object" && !Array.isArray(data)) {
      let missing0;
      if (data.requestId === void 0 && (missing0 = "requestId") || data.attempt === void 0 && (missing0 = "attempt") || data.phase === void 0 && (missing0 = "phase") || data.delivery === void 0 && (missing0 = "delivery") || data.queueMs === void 0 && (missing0 = "queueMs") || data.headersMs === void 0 && (missing0 = "headersMs") || data.bodyMs === void 0 && (missing0 = "bodyMs") || data.totalMs === void 0 && (missing0 = "totalMs") || data.requestBytes === void 0 && (missing0 = "requestBytes") || data.responseBytes === void 0 && (missing0 = "responseBytes") || data.tlsProfile === void 0 && (missing0 = "tlsProfile")) {
        validate16.errors = [{ instancePath, schemaPath: "#/required", keyword: "required", params: { missingProperty: missing0 }, message: "must have required property '" + missing0 + "'" }];
        return false;
      } else {
        if (data.attempt !== void 0) {
          let data0 = data.attempt;
          const _errs1 = errors;
          if (!(typeof data0 == "number" && (!(data0 % 1) && !isNaN(data0)) && isFinite(data0))) {
            validate16.errors = [{ instancePath: instancePath + "/attempt", schemaPath: "#/properties/attempt/type", keyword: "type", params: { type: "integer" }, message: "must be integer" }];
            return false;
          }
          if (errors === _errs1) {
            if (typeof data0 == "number" && isFinite(data0)) {
              if (data0 > 9007199254740991 || isNaN(data0)) {
                validate16.errors = [{ instancePath: instancePath + "/attempt", schemaPath: "#/properties/attempt/maximum", keyword: "maximum", params: { comparison: "<=", limit: 9007199254740991 }, message: "must be <= 9007199254740991" }];
                return false;
              } else {
                if (data0 < 0 || isNaN(data0)) {
                  validate16.errors = [{ instancePath: instancePath + "/attempt", schemaPath: "#/properties/attempt/minimum", keyword: "minimum", params: { comparison: ">=", limit: 0 }, message: "must be >= 0" }];
                  return false;
                }
              }
            }
          }
          var valid0 = _errs1 === errors;
        } else {
          var valid0 = true;
        }
        if (valid0) {
          if (data.bodyMs !== void 0) {
            let data1 = data.bodyMs;
            const _errs3 = errors;
            if (!(typeof data1 == "number" && (!(data1 % 1) && !isNaN(data1)) && isFinite(data1)) && data1 !== null) {
              validate16.errors = [{ instancePath: instancePath + "/bodyMs", schemaPath: "#/properties/bodyMs/type", keyword: "type", params: { type: schema19.properties.bodyMs.type }, message: "must be integer,null" }];
              return false;
            }
            if (errors === _errs3) {
              if (typeof data1 == "number" && isFinite(data1)) {
                if (data1 > 9007199254740991 || isNaN(data1)) {
                  validate16.errors = [{ instancePath: instancePath + "/bodyMs", schemaPath: "#/properties/bodyMs/maximum", keyword: "maximum", params: { comparison: "<=", limit: 9007199254740991 }, message: "must be <= 9007199254740991" }];
                  return false;
                } else {
                  if (data1 < 0 || isNaN(data1)) {
                    validate16.errors = [{ instancePath: instancePath + "/bodyMs", schemaPath: "#/properties/bodyMs/minimum", keyword: "minimum", params: { comparison: ">=", limit: 0 }, message: "must be >= 0" }];
                    return false;
                  }
                }
              }
            }
            var valid0 = _errs3 === errors;
          } else {
            var valid0 = true;
          }
          if (valid0) {
            if (data.clientReused !== void 0) {
              let data2 = data.clientReused;
              const _errs5 = errors;
              if (typeof data2 !== "boolean" && data2 !== null) {
                validate16.errors = [{ instancePath: instancePath + "/clientReused", schemaPath: "#/properties/clientReused/type", keyword: "type", params: { type: schema19.properties.clientReused.type }, message: "must be boolean,null" }];
                return false;
              }
              var valid0 = _errs5 === errors;
            } else {
              var valid0 = true;
            }
            if (valid0) {
              if (data.contextId !== void 0) {
                let data3 = data.contextId;
                const _errs7 = errors;
                if (typeof data3 !== "string" && data3 !== null) {
                  validate16.errors = [{ instancePath: instancePath + "/contextId", schemaPath: "#/properties/contextId/type", keyword: "type", params: { type: schema19.properties.contextId.type }, message: "must be string,null" }];
                  return false;
                }
                var valid0 = _errs7 === errors;
              } else {
                var valid0 = true;
              }
              if (valid0) {
                if (data.cookieRevision !== void 0) {
                  let data4 = data.cookieRevision;
                  const _errs9 = errors;
                  if (!(typeof data4 == "number" && (!(data4 % 1) && !isNaN(data4)) && isFinite(data4)) && data4 !== null) {
                    validate16.errors = [{ instancePath: instancePath + "/cookieRevision", schemaPath: "#/properties/cookieRevision/type", keyword: "type", params: { type: schema19.properties.cookieRevision.type }, message: "must be integer,null" }];
                    return false;
                  }
                  if (errors === _errs9) {
                    if (typeof data4 == "number" && isFinite(data4)) {
                      if (data4 > 9007199254740991 || isNaN(data4)) {
                        validate16.errors = [{ instancePath: instancePath + "/cookieRevision", schemaPath: "#/properties/cookieRevision/maximum", keyword: "maximum", params: { comparison: "<=", limit: 9007199254740991 }, message: "must be <= 9007199254740991" }];
                        return false;
                      } else {
                        if (data4 < 0 || isNaN(data4)) {
                          validate16.errors = [{ instancePath: instancePath + "/cookieRevision", schemaPath: "#/properties/cookieRevision/minimum", keyword: "minimum", params: { comparison: ">=", limit: 0 }, message: "must be >= 0" }];
                          return false;
                        }
                      }
                    }
                  }
                  var valid0 = _errs9 === errors;
                } else {
                  var valid0 = true;
                }
                if (valid0) {
                  if (data.delivery !== void 0) {
                    let data5 = data.delivery;
                    const _errs11 = errors;
                    if (typeof data5 !== "string") {
                      validate16.errors = [{ instancePath: instancePath + "/delivery", schemaPath: "#/definitions/Delivery/type", keyword: "type", params: { type: "string" }, message: "must be string" }];
                      return false;
                    }
                    if (!(data5 === "not_started" || data5 === "possibly_sent" || data5 === "response_started")) {
                      validate16.errors = [{ instancePath: instancePath + "/delivery", schemaPath: "#/definitions/Delivery/enum", keyword: "enum", params: { allowedValues: schema20.enum }, message: "must be equal to one of the allowed values" }];
                      return false;
                    }
                    var valid0 = _errs11 === errors;
                  } else {
                    var valid0 = true;
                  }
                  if (valid0) {
                    if (data.headersMs !== void 0) {
                      let data6 = data.headersMs;
                      const _errs14 = errors;
                      if (!(typeof data6 == "number" && (!(data6 % 1) && !isNaN(data6)) && isFinite(data6)) && data6 !== null) {
                        validate16.errors = [{ instancePath: instancePath + "/headersMs", schemaPath: "#/properties/headersMs/type", keyword: "type", params: { type: schema19.properties.headersMs.type }, message: "must be integer,null" }];
                        return false;
                      }
                      if (errors === _errs14) {
                        if (typeof data6 == "number" && isFinite(data6)) {
                          if (data6 > 9007199254740991 || isNaN(data6)) {
                            validate16.errors = [{ instancePath: instancePath + "/headersMs", schemaPath: "#/properties/headersMs/maximum", keyword: "maximum", params: { comparison: "<=", limit: 9007199254740991 }, message: "must be <= 9007199254740991" }];
                            return false;
                          } else {
                            if (data6 < 0 || isNaN(data6)) {
                              validate16.errors = [{ instancePath: instancePath + "/headersMs", schemaPath: "#/properties/headersMs/minimum", keyword: "minimum", params: { comparison: ">=", limit: 0 }, message: "must be >= 0" }];
                              return false;
                            }
                          }
                        }
                      }
                      var valid0 = _errs14 === errors;
                    } else {
                      var valid0 = true;
                    }
                    if (valid0) {
                      if (data.phase !== void 0) {
                        let data7 = data.phase;
                        const _errs16 = errors;
                        if (typeof data7 !== "string") {
                          validate16.errors = [{ instancePath: instancePath + "/phase", schemaPath: "#/definitions/Phase/type", keyword: "type", params: { type: "string" }, message: "must be string" }];
                          return false;
                        }
                        if (!(data7 === "queued" || data7 === "preparing" || data7 === "upstream" || data7 === "body" || data7 === "complete")) {
                          validate16.errors = [{ instancePath: instancePath + "/phase", schemaPath: "#/definitions/Phase/enum", keyword: "enum", params: { allowedValues: schema21.enum }, message: "must be equal to one of the allowed values" }];
                          return false;
                        }
                        var valid0 = _errs16 === errors;
                      } else {
                        var valid0 = true;
                      }
                      if (valid0) {
                        if (data.queueMs !== void 0) {
                          let data8 = data.queueMs;
                          const _errs19 = errors;
                          if (!(typeof data8 == "number" && (!(data8 % 1) && !isNaN(data8)) && isFinite(data8))) {
                            validate16.errors = [{ instancePath: instancePath + "/queueMs", schemaPath: "#/properties/queueMs/type", keyword: "type", params: { type: "integer" }, message: "must be integer" }];
                            return false;
                          }
                          if (errors === _errs19) {
                            if (typeof data8 == "number" && isFinite(data8)) {
                              if (data8 > 9007199254740991 || isNaN(data8)) {
                                validate16.errors = [{ instancePath: instancePath + "/queueMs", schemaPath: "#/properties/queueMs/maximum", keyword: "maximum", params: { comparison: "<=", limit: 9007199254740991 }, message: "must be <= 9007199254740991" }];
                                return false;
                              } else {
                                if (data8 < 0 || isNaN(data8)) {
                                  validate16.errors = [{ instancePath: instancePath + "/queueMs", schemaPath: "#/properties/queueMs/minimum", keyword: "minimum", params: { comparison: ">=", limit: 0 }, message: "must be >= 0" }];
                                  return false;
                                }
                              }
                            }
                          }
                          var valid0 = _errs19 === errors;
                        } else {
                          var valid0 = true;
                        }
                        if (valid0) {
                          if (data.requestBytes !== void 0) {
                            let data9 = data.requestBytes;
                            const _errs21 = errors;
                            if (!(typeof data9 == "number" && (!(data9 % 1) && !isNaN(data9)) && isFinite(data9))) {
                              validate16.errors = [{ instancePath: instancePath + "/requestBytes", schemaPath: "#/properties/requestBytes/type", keyword: "type", params: { type: "integer" }, message: "must be integer" }];
                              return false;
                            }
                            if (errors === _errs21) {
                              if (typeof data9 == "number" && isFinite(data9)) {
                                if (data9 > 9007199254740991 || isNaN(data9)) {
                                  validate16.errors = [{ instancePath: instancePath + "/requestBytes", schemaPath: "#/properties/requestBytes/maximum", keyword: "maximum", params: { comparison: "<=", limit: 9007199254740991 }, message: "must be <= 9007199254740991" }];
                                  return false;
                                } else {
                                  if (data9 < 0 || isNaN(data9)) {
                                    validate16.errors = [{ instancePath: instancePath + "/requestBytes", schemaPath: "#/properties/requestBytes/minimum", keyword: "minimum", params: { comparison: ">=", limit: 0 }, message: "must be >= 0" }];
                                    return false;
                                  }
                                }
                              }
                            }
                            var valid0 = _errs21 === errors;
                          } else {
                            var valid0 = true;
                          }
                          if (valid0) {
                            if (data.requestId !== void 0) {
                              const _errs23 = errors;
                              if (typeof data.requestId !== "string") {
                                validate16.errors = [{ instancePath: instancePath + "/requestId", schemaPath: "#/properties/requestId/type", keyword: "type", params: { type: "string" }, message: "must be string" }];
                                return false;
                              }
                              var valid0 = _errs23 === errors;
                            } else {
                              var valid0 = true;
                            }
                            if (valid0) {
                              if (data.responseBytes !== void 0) {
                                let data11 = data.responseBytes;
                                const _errs25 = errors;
                                if (!(typeof data11 == "number" && (!(data11 % 1) && !isNaN(data11)) && isFinite(data11))) {
                                  validate16.errors = [{ instancePath: instancePath + "/responseBytes", schemaPath: "#/properties/responseBytes/type", keyword: "type", params: { type: "integer" }, message: "must be integer" }];
                                  return false;
                                }
                                if (errors === _errs25) {
                                  if (typeof data11 == "number" && isFinite(data11)) {
                                    if (data11 > 9007199254740991 || isNaN(data11)) {
                                      validate16.errors = [{ instancePath: instancePath + "/responseBytes", schemaPath: "#/properties/responseBytes/maximum", keyword: "maximum", params: { comparison: "<=", limit: 9007199254740991 }, message: "must be <= 9007199254740991" }];
                                      return false;
                                    } else {
                                      if (data11 < 0 || isNaN(data11)) {
                                        validate16.errors = [{ instancePath: instancePath + "/responseBytes", schemaPath: "#/properties/responseBytes/minimum", keyword: "minimum", params: { comparison: ">=", limit: 0 }, message: "must be >= 0" }];
                                        return false;
                                      }
                                    }
                                  }
                                }
                                var valid0 = _errs25 === errors;
                              } else {
                                var valid0 = true;
                              }
                              if (valid0) {
                                if (data.tlsProfile !== void 0) {
                                  const _errs27 = errors;
                                  if (typeof data.tlsProfile !== "string") {
                                    validate16.errors = [{ instancePath: instancePath + "/tlsProfile", schemaPath: "#/properties/tlsProfile/type", keyword: "type", params: { type: "string" }, message: "must be string" }];
                                    return false;
                                  }
                                  var valid0 = _errs27 === errors;
                                } else {
                                  var valid0 = true;
                                }
                                if (valid0) {
                                  if (data.totalMs !== void 0) {
                                    let data13 = data.totalMs;
                                    const _errs29 = errors;
                                    if (!(typeof data13 == "number" && (!(data13 % 1) && !isNaN(data13)) && isFinite(data13))) {
                                      validate16.errors = [{ instancePath: instancePath + "/totalMs", schemaPath: "#/properties/totalMs/type", keyword: "type", params: { type: "integer" }, message: "must be integer" }];
                                      return false;
                                    }
                                    if (errors === _errs29) {
                                      if (typeof data13 == "number" && isFinite(data13)) {
                                        if (data13 > 9007199254740991 || isNaN(data13)) {
                                          validate16.errors = [{ instancePath: instancePath + "/totalMs", schemaPath: "#/properties/totalMs/maximum", keyword: "maximum", params: { comparison: "<=", limit: 9007199254740991 }, message: "must be <= 9007199254740991" }];
                                          return false;
                                        } else {
                                          if (data13 < 0 || isNaN(data13)) {
                                            validate16.errors = [{ instancePath: instancePath + "/totalMs", schemaPath: "#/properties/totalMs/minimum", keyword: "minimum", params: { comparison: ">=", limit: 0 }, message: "must be >= 0" }];
                                            return false;
                                          }
                                        }
                                      }
                                    }
                                    var valid0 = _errs29 === errors;
                                  } else {
                                    var valid0 = true;
                                  }
                                  if (valid0) {
                                    if (data.traceId !== void 0) {
                                      let data14 = data.traceId;
                                      const _errs31 = errors;
                                      if (typeof data14 !== "string" && data14 !== null) {
                                        validate16.errors = [{ instancePath: instancePath + "/traceId", schemaPath: "#/properties/traceId/type", keyword: "type", params: { type: schema19.properties.traceId.type }, message: "must be string,null" }];
                                        return false;
                                      }
                                      var valid0 = _errs31 === errors;
                                    } else {
                                      var valid0 = true;
                                    }
                                  }
                                }
                              }
                            }
                          }
                        }
                      }
                    }
                  }
                }
              }
            }
          }
        }
      }
    } else {
      validate16.errors = [{ instancePath, schemaPath: "#/type", keyword: "type", params: { type: "object" }, message: "must be object" }];
      return false;
    }
  }
  validate16.errors = vErrors;
  return errors === 0;
}
var transportError = validate17;
var schema23 = { "enum": ["UNAUTHORIZED", "INVALID_REQUEST", "UNSUPPORTED_CAPABILITY", "INVALID_PROFILE", "EGRESS_REQUIRED", "SSRF_BLOCKED", "BODY_TOO_LARGE", "BUSY", "TIMEOUT", "CANCELLED", "DNS_ERROR", "PROXY_ERROR", "TLS_ERROR", "CONNECT_ERROR", "PROTOCOL_ERROR", "CONTEXT_NOT_FOUND", "CONTEXT_CONFLICT", "CONTEXT_LIMIT", "COOKIE_LIMIT", "DUPLICATE_REQUEST", "UNKNOWN"], "type": "string" };
var schema24 = { "properties": { "attempt": { "format": "uint64", "minimum": 0, "type": "integer", "maximum": 9007199254740991 }, "bodyMs": { "format": "uint64", "minimum": 0, "type": ["integer", "null"], "maximum": 9007199254740991 }, "clientReused": { "type": ["boolean", "null"] }, "contextId": { "type": ["string", "null"] }, "cookieRevision": { "format": "uint64", "minimum": 0, "type": ["integer", "null"], "maximum": 9007199254740991 }, "delivery": { "$ref": "#/definitions/Delivery" }, "headersMs": { "format": "uint64", "minimum": 0, "type": ["integer", "null"], "maximum": 9007199254740991 }, "phase": { "$ref": "#/definitions/Phase" }, "queueMs": { "format": "uint64", "minimum": 0, "type": "integer", "maximum": 9007199254740991 }, "requestBytes": { "format": "uint64", "minimum": 0, "type": "integer", "maximum": 9007199254740991 }, "requestId": { "type": "string" }, "responseBytes": { "format": "uint64", "minimum": 0, "type": "integer", "maximum": 9007199254740991 }, "tlsProfile": { "type": "string" }, "totalMs": { "format": "uint64", "minimum": 0, "type": "integer", "maximum": 9007199254740991 }, "traceId": { "type": ["string", "null"] } }, "required": ["requestId", "attempt", "phase", "delivery", "queueMs", "headersMs", "bodyMs", "totalMs", "requestBytes", "responseBytes", "tlsProfile"], "type": "object" };
var schema25 = { "enum": ["not_started", "possibly_sent", "response_started"], "type": "string" };
var schema26 = { "enum": ["queued", "preparing", "upstream", "body", "complete"], "type": "string" };
function validate18(data, { instancePath = "", parentData, parentDataProperty, rootData = data } = {}) {
  let vErrors = null;
  let errors = 0;
  if (errors === 0) {
    if (data && typeof data == "object" && !Array.isArray(data)) {
      let missing0;
      if (data.requestId === void 0 && (missing0 = "requestId") || data.attempt === void 0 && (missing0 = "attempt") || data.phase === void 0 && (missing0 = "phase") || data.delivery === void 0 && (missing0 = "delivery") || data.queueMs === void 0 && (missing0 = "queueMs") || data.headersMs === void 0 && (missing0 = "headersMs") || data.bodyMs === void 0 && (missing0 = "bodyMs") || data.totalMs === void 0 && (missing0 = "totalMs") || data.requestBytes === void 0 && (missing0 = "requestBytes") || data.responseBytes === void 0 && (missing0 = "responseBytes") || data.tlsProfile === void 0 && (missing0 = "tlsProfile")) {
        validate18.errors = [{ instancePath, schemaPath: "#/required", keyword: "required", params: { missingProperty: missing0 }, message: "must have required property '" + missing0 + "'" }];
        return false;
      } else {
        if (data.attempt !== void 0) {
          let data0 = data.attempt;
          const _errs1 = errors;
          if (!(typeof data0 == "number" && (!(data0 % 1) && !isNaN(data0)) && isFinite(data0))) {
            validate18.errors = [{ instancePath: instancePath + "/attempt", schemaPath: "#/properties/attempt/type", keyword: "type", params: { type: "integer" }, message: "must be integer" }];
            return false;
          }
          if (errors === _errs1) {
            if (typeof data0 == "number" && isFinite(data0)) {
              if (data0 > 9007199254740991 || isNaN(data0)) {
                validate18.errors = [{ instancePath: instancePath + "/attempt", schemaPath: "#/properties/attempt/maximum", keyword: "maximum", params: { comparison: "<=", limit: 9007199254740991 }, message: "must be <= 9007199254740991" }];
                return false;
              } else {
                if (data0 < 0 || isNaN(data0)) {
                  validate18.errors = [{ instancePath: instancePath + "/attempt", schemaPath: "#/properties/attempt/minimum", keyword: "minimum", params: { comparison: ">=", limit: 0 }, message: "must be >= 0" }];
                  return false;
                }
              }
            }
          }
          var valid0 = _errs1 === errors;
        } else {
          var valid0 = true;
        }
        if (valid0) {
          if (data.bodyMs !== void 0) {
            let data1 = data.bodyMs;
            const _errs3 = errors;
            if (!(typeof data1 == "number" && (!(data1 % 1) && !isNaN(data1)) && isFinite(data1)) && data1 !== null) {
              validate18.errors = [{ instancePath: instancePath + "/bodyMs", schemaPath: "#/properties/bodyMs/type", keyword: "type", params: { type: schema24.properties.bodyMs.type }, message: "must be integer,null" }];
              return false;
            }
            if (errors === _errs3) {
              if (typeof data1 == "number" && isFinite(data1)) {
                if (data1 > 9007199254740991 || isNaN(data1)) {
                  validate18.errors = [{ instancePath: instancePath + "/bodyMs", schemaPath: "#/properties/bodyMs/maximum", keyword: "maximum", params: { comparison: "<=", limit: 9007199254740991 }, message: "must be <= 9007199254740991" }];
                  return false;
                } else {
                  if (data1 < 0 || isNaN(data1)) {
                    validate18.errors = [{ instancePath: instancePath + "/bodyMs", schemaPath: "#/properties/bodyMs/minimum", keyword: "minimum", params: { comparison: ">=", limit: 0 }, message: "must be >= 0" }];
                    return false;
                  }
                }
              }
            }
            var valid0 = _errs3 === errors;
          } else {
            var valid0 = true;
          }
          if (valid0) {
            if (data.clientReused !== void 0) {
              let data2 = data.clientReused;
              const _errs5 = errors;
              if (typeof data2 !== "boolean" && data2 !== null) {
                validate18.errors = [{ instancePath: instancePath + "/clientReused", schemaPath: "#/properties/clientReused/type", keyword: "type", params: { type: schema24.properties.clientReused.type }, message: "must be boolean,null" }];
                return false;
              }
              var valid0 = _errs5 === errors;
            } else {
              var valid0 = true;
            }
            if (valid0) {
              if (data.contextId !== void 0) {
                let data3 = data.contextId;
                const _errs7 = errors;
                if (typeof data3 !== "string" && data3 !== null) {
                  validate18.errors = [{ instancePath: instancePath + "/contextId", schemaPath: "#/properties/contextId/type", keyword: "type", params: { type: schema24.properties.contextId.type }, message: "must be string,null" }];
                  return false;
                }
                var valid0 = _errs7 === errors;
              } else {
                var valid0 = true;
              }
              if (valid0) {
                if (data.cookieRevision !== void 0) {
                  let data4 = data.cookieRevision;
                  const _errs9 = errors;
                  if (!(typeof data4 == "number" && (!(data4 % 1) && !isNaN(data4)) && isFinite(data4)) && data4 !== null) {
                    validate18.errors = [{ instancePath: instancePath + "/cookieRevision", schemaPath: "#/properties/cookieRevision/type", keyword: "type", params: { type: schema24.properties.cookieRevision.type }, message: "must be integer,null" }];
                    return false;
                  }
                  if (errors === _errs9) {
                    if (typeof data4 == "number" && isFinite(data4)) {
                      if (data4 > 9007199254740991 || isNaN(data4)) {
                        validate18.errors = [{ instancePath: instancePath + "/cookieRevision", schemaPath: "#/properties/cookieRevision/maximum", keyword: "maximum", params: { comparison: "<=", limit: 9007199254740991 }, message: "must be <= 9007199254740991" }];
                        return false;
                      } else {
                        if (data4 < 0 || isNaN(data4)) {
                          validate18.errors = [{ instancePath: instancePath + "/cookieRevision", schemaPath: "#/properties/cookieRevision/minimum", keyword: "minimum", params: { comparison: ">=", limit: 0 }, message: "must be >= 0" }];
                          return false;
                        }
                      }
                    }
                  }
                  var valid0 = _errs9 === errors;
                } else {
                  var valid0 = true;
                }
                if (valid0) {
                  if (data.delivery !== void 0) {
                    let data5 = data.delivery;
                    const _errs11 = errors;
                    if (typeof data5 !== "string") {
                      validate18.errors = [{ instancePath: instancePath + "/delivery", schemaPath: "#/definitions/Delivery/type", keyword: "type", params: { type: "string" }, message: "must be string" }];
                      return false;
                    }
                    if (!(data5 === "not_started" || data5 === "possibly_sent" || data5 === "response_started")) {
                      validate18.errors = [{ instancePath: instancePath + "/delivery", schemaPath: "#/definitions/Delivery/enum", keyword: "enum", params: { allowedValues: schema25.enum }, message: "must be equal to one of the allowed values" }];
                      return false;
                    }
                    var valid0 = _errs11 === errors;
                  } else {
                    var valid0 = true;
                  }
                  if (valid0) {
                    if (data.headersMs !== void 0) {
                      let data6 = data.headersMs;
                      const _errs14 = errors;
                      if (!(typeof data6 == "number" && (!(data6 % 1) && !isNaN(data6)) && isFinite(data6)) && data6 !== null) {
                        validate18.errors = [{ instancePath: instancePath + "/headersMs", schemaPath: "#/properties/headersMs/type", keyword: "type", params: { type: schema24.properties.headersMs.type }, message: "must be integer,null" }];
                        return false;
                      }
                      if (errors === _errs14) {
                        if (typeof data6 == "number" && isFinite(data6)) {
                          if (data6 > 9007199254740991 || isNaN(data6)) {
                            validate18.errors = [{ instancePath: instancePath + "/headersMs", schemaPath: "#/properties/headersMs/maximum", keyword: "maximum", params: { comparison: "<=", limit: 9007199254740991 }, message: "must be <= 9007199254740991" }];
                            return false;
                          } else {
                            if (data6 < 0 || isNaN(data6)) {
                              validate18.errors = [{ instancePath: instancePath + "/headersMs", schemaPath: "#/properties/headersMs/minimum", keyword: "minimum", params: { comparison: ">=", limit: 0 }, message: "must be >= 0" }];
                              return false;
                            }
                          }
                        }
                      }
                      var valid0 = _errs14 === errors;
                    } else {
                      var valid0 = true;
                    }
                    if (valid0) {
                      if (data.phase !== void 0) {
                        let data7 = data.phase;
                        const _errs16 = errors;
                        if (typeof data7 !== "string") {
                          validate18.errors = [{ instancePath: instancePath + "/phase", schemaPath: "#/definitions/Phase/type", keyword: "type", params: { type: "string" }, message: "must be string" }];
                          return false;
                        }
                        if (!(data7 === "queued" || data7 === "preparing" || data7 === "upstream" || data7 === "body" || data7 === "complete")) {
                          validate18.errors = [{ instancePath: instancePath + "/phase", schemaPath: "#/definitions/Phase/enum", keyword: "enum", params: { allowedValues: schema26.enum }, message: "must be equal to one of the allowed values" }];
                          return false;
                        }
                        var valid0 = _errs16 === errors;
                      } else {
                        var valid0 = true;
                      }
                      if (valid0) {
                        if (data.queueMs !== void 0) {
                          let data8 = data.queueMs;
                          const _errs19 = errors;
                          if (!(typeof data8 == "number" && (!(data8 % 1) && !isNaN(data8)) && isFinite(data8))) {
                            validate18.errors = [{ instancePath: instancePath + "/queueMs", schemaPath: "#/properties/queueMs/type", keyword: "type", params: { type: "integer" }, message: "must be integer" }];
                            return false;
                          }
                          if (errors === _errs19) {
                            if (typeof data8 == "number" && isFinite(data8)) {
                              if (data8 > 9007199254740991 || isNaN(data8)) {
                                validate18.errors = [{ instancePath: instancePath + "/queueMs", schemaPath: "#/properties/queueMs/maximum", keyword: "maximum", params: { comparison: "<=", limit: 9007199254740991 }, message: "must be <= 9007199254740991" }];
                                return false;
                              } else {
                                if (data8 < 0 || isNaN(data8)) {
                                  validate18.errors = [{ instancePath: instancePath + "/queueMs", schemaPath: "#/properties/queueMs/minimum", keyword: "minimum", params: { comparison: ">=", limit: 0 }, message: "must be >= 0" }];
                                  return false;
                                }
                              }
                            }
                          }
                          var valid0 = _errs19 === errors;
                        } else {
                          var valid0 = true;
                        }
                        if (valid0) {
                          if (data.requestBytes !== void 0) {
                            let data9 = data.requestBytes;
                            const _errs21 = errors;
                            if (!(typeof data9 == "number" && (!(data9 % 1) && !isNaN(data9)) && isFinite(data9))) {
                              validate18.errors = [{ instancePath: instancePath + "/requestBytes", schemaPath: "#/properties/requestBytes/type", keyword: "type", params: { type: "integer" }, message: "must be integer" }];
                              return false;
                            }
                            if (errors === _errs21) {
                              if (typeof data9 == "number" && isFinite(data9)) {
                                if (data9 > 9007199254740991 || isNaN(data9)) {
                                  validate18.errors = [{ instancePath: instancePath + "/requestBytes", schemaPath: "#/properties/requestBytes/maximum", keyword: "maximum", params: { comparison: "<=", limit: 9007199254740991 }, message: "must be <= 9007199254740991" }];
                                  return false;
                                } else {
                                  if (data9 < 0 || isNaN(data9)) {
                                    validate18.errors = [{ instancePath: instancePath + "/requestBytes", schemaPath: "#/properties/requestBytes/minimum", keyword: "minimum", params: { comparison: ">=", limit: 0 }, message: "must be >= 0" }];
                                    return false;
                                  }
                                }
                              }
                            }
                            var valid0 = _errs21 === errors;
                          } else {
                            var valid0 = true;
                          }
                          if (valid0) {
                            if (data.requestId !== void 0) {
                              const _errs23 = errors;
                              if (typeof data.requestId !== "string") {
                                validate18.errors = [{ instancePath: instancePath + "/requestId", schemaPath: "#/properties/requestId/type", keyword: "type", params: { type: "string" }, message: "must be string" }];
                                return false;
                              }
                              var valid0 = _errs23 === errors;
                            } else {
                              var valid0 = true;
                            }
                            if (valid0) {
                              if (data.responseBytes !== void 0) {
                                let data11 = data.responseBytes;
                                const _errs25 = errors;
                                if (!(typeof data11 == "number" && (!(data11 % 1) && !isNaN(data11)) && isFinite(data11))) {
                                  validate18.errors = [{ instancePath: instancePath + "/responseBytes", schemaPath: "#/properties/responseBytes/type", keyword: "type", params: { type: "integer" }, message: "must be integer" }];
                                  return false;
                                }
                                if (errors === _errs25) {
                                  if (typeof data11 == "number" && isFinite(data11)) {
                                    if (data11 > 9007199254740991 || isNaN(data11)) {
                                      validate18.errors = [{ instancePath: instancePath + "/responseBytes", schemaPath: "#/properties/responseBytes/maximum", keyword: "maximum", params: { comparison: "<=", limit: 9007199254740991 }, message: "must be <= 9007199254740991" }];
                                      return false;
                                    } else {
                                      if (data11 < 0 || isNaN(data11)) {
                                        validate18.errors = [{ instancePath: instancePath + "/responseBytes", schemaPath: "#/properties/responseBytes/minimum", keyword: "minimum", params: { comparison: ">=", limit: 0 }, message: "must be >= 0" }];
                                        return false;
                                      }
                                    }
                                  }
                                }
                                var valid0 = _errs25 === errors;
                              } else {
                                var valid0 = true;
                              }
                              if (valid0) {
                                if (data.tlsProfile !== void 0) {
                                  const _errs27 = errors;
                                  if (typeof data.tlsProfile !== "string") {
                                    validate18.errors = [{ instancePath: instancePath + "/tlsProfile", schemaPath: "#/properties/tlsProfile/type", keyword: "type", params: { type: "string" }, message: "must be string" }];
                                    return false;
                                  }
                                  var valid0 = _errs27 === errors;
                                } else {
                                  var valid0 = true;
                                }
                                if (valid0) {
                                  if (data.totalMs !== void 0) {
                                    let data13 = data.totalMs;
                                    const _errs29 = errors;
                                    if (!(typeof data13 == "number" && (!(data13 % 1) && !isNaN(data13)) && isFinite(data13))) {
                                      validate18.errors = [{ instancePath: instancePath + "/totalMs", schemaPath: "#/properties/totalMs/type", keyword: "type", params: { type: "integer" }, message: "must be integer" }];
                                      return false;
                                    }
                                    if (errors === _errs29) {
                                      if (typeof data13 == "number" && isFinite(data13)) {
                                        if (data13 > 9007199254740991 || isNaN(data13)) {
                                          validate18.errors = [{ instancePath: instancePath + "/totalMs", schemaPath: "#/properties/totalMs/maximum", keyword: "maximum", params: { comparison: "<=", limit: 9007199254740991 }, message: "must be <= 9007199254740991" }];
                                          return false;
                                        } else {
                                          if (data13 < 0 || isNaN(data13)) {
                                            validate18.errors = [{ instancePath: instancePath + "/totalMs", schemaPath: "#/properties/totalMs/minimum", keyword: "minimum", params: { comparison: ">=", limit: 0 }, message: "must be >= 0" }];
                                            return false;
                                          }
                                        }
                                      }
                                    }
                                    var valid0 = _errs29 === errors;
                                  } else {
                                    var valid0 = true;
                                  }
                                  if (valid0) {
                                    if (data.traceId !== void 0) {
                                      let data14 = data.traceId;
                                      const _errs31 = errors;
                                      if (typeof data14 !== "string" && data14 !== null) {
                                        validate18.errors = [{ instancePath: instancePath + "/traceId", schemaPath: "#/properties/traceId/type", keyword: "type", params: { type: schema24.properties.traceId.type }, message: "must be string,null" }];
                                        return false;
                                      }
                                      var valid0 = _errs31 === errors;
                                    } else {
                                      var valid0 = true;
                                    }
                                  }
                                }
                              }
                            }
                          }
                        }
                      }
                    }
                  }
                }
              }
            }
          }
        }
      }
    } else {
      validate18.errors = [{ instancePath, schemaPath: "#/type", keyword: "type", params: { type: "object" }, message: "must be object" }];
      return false;
    }
  }
  validate18.errors = vErrors;
  return errors === 0;
}
function validate17(data, { instancePath = "", parentData, parentDataProperty, rootData = data } = {}) {
  ;
  let vErrors = null;
  let errors = 0;
  if (errors === 0) {
    if (data && typeof data == "object" && !Array.isArray(data)) {
      let missing0;
      if (data.code === void 0 && (missing0 = "code") || data.message === void 0 && (missing0 = "message")) {
        validate17.errors = [{ instancePath, schemaPath: "#/required", keyword: "required", params: { missingProperty: missing0 }, message: "must have required property '" + missing0 + "'" }];
        return false;
      } else {
        if (data.code !== void 0) {
          let data0 = data.code;
          const _errs1 = errors;
          if (typeof data0 !== "string") {
            validate17.errors = [{ instancePath: instancePath + "/code", schemaPath: "#/definitions/ErrorCode/type", keyword: "type", params: { type: "string" }, message: "must be string" }];
            return false;
          }
          if (!(data0 === "UNAUTHORIZED" || data0 === "INVALID_REQUEST" || data0 === "UNSUPPORTED_CAPABILITY" || data0 === "INVALID_PROFILE" || data0 === "EGRESS_REQUIRED" || data0 === "SSRF_BLOCKED" || data0 === "BODY_TOO_LARGE" || data0 === "BUSY" || data0 === "TIMEOUT" || data0 === "CANCELLED" || data0 === "DNS_ERROR" || data0 === "PROXY_ERROR" || data0 === "TLS_ERROR" || data0 === "CONNECT_ERROR" || data0 === "PROTOCOL_ERROR" || data0 === "CONTEXT_NOT_FOUND" || data0 === "CONTEXT_CONFLICT" || data0 === "CONTEXT_LIMIT" || data0 === "COOKIE_LIMIT" || data0 === "DUPLICATE_REQUEST" || data0 === "UNKNOWN")) {
            validate17.errors = [{ instancePath: instancePath + "/code", schemaPath: "#/definitions/ErrorCode/enum", keyword: "enum", params: { allowedValues: schema23.enum }, message: "must be equal to one of the allowed values" }];
            return false;
          }
          var valid0 = _errs1 === errors;
        } else {
          var valid0 = true;
        }
        if (valid0) {
          if (data.diagnostics !== void 0) {
            let data1 = data.diagnostics;
            const _errs4 = errors;
            const _errs5 = errors;
            let valid2 = false;
            const _errs6 = errors;
            if (!validate18(data1, { instancePath: instancePath + "/diagnostics", parentData: data, parentDataProperty: "diagnostics", rootData })) {
              vErrors = vErrors === null ? validate18.errors : vErrors.concat(validate18.errors);
              errors = vErrors.length;
            }
            var _valid0 = _errs6 === errors;
            valid2 = valid2 || _valid0;
            if (!valid2) {
              const _errs7 = errors;
              if (data1 !== null) {
                const err0 = { instancePath: instancePath + "/diagnostics", schemaPath: "#/properties/diagnostics/anyOf/1/type", keyword: "type", params: { type: "null" }, message: "must be null" };
                if (vErrors === null) {
                  vErrors = [err0];
                } else {
                  vErrors.push(err0);
                }
                errors++;
              }
              var _valid0 = _errs7 === errors;
              valid2 = valid2 || _valid0;
            }
            if (!valid2) {
              const err1 = { instancePath: instancePath + "/diagnostics", schemaPath: "#/properties/diagnostics/anyOf", keyword: "anyOf", params: {}, message: "must match a schema in anyOf" };
              if (vErrors === null) {
                vErrors = [err1];
              } else {
                vErrors.push(err1);
              }
              errors++;
              validate17.errors = vErrors;
              return false;
            } else {
              errors = _errs5;
              if (vErrors !== null) {
                if (_errs5) {
                  vErrors.length = _errs5;
                } else {
                  vErrors = null;
                }
              }
            }
            var valid0 = _errs4 === errors;
          } else {
            var valid0 = true;
          }
          if (valid0) {
            if (data.message !== void 0) {
              const _errs9 = errors;
              if (typeof data.message !== "string") {
                validate17.errors = [{ instancePath: instancePath + "/message", schemaPath: "#/properties/message/type", keyword: "type", params: { type: "string" }, message: "must be string" }];
                return false;
              }
              var valid0 = _errs9 === errors;
            } else {
              var valid0 = true;
            }
          }
        }
      }
    } else {
      validate17.errors = [{ instancePath, schemaPath: "#/type", keyword: "type", params: { type: "object" }, message: "must be object" }];
      return false;
    }
  }
  validate17.errors = vErrors;
  return errors === 0;
}
var contextInfo = validate20;
var schema28 = { "enum": ["external", "managed"], "type": "string" };
var schema29 = { "additionalProperties": false, "properties": { "emulateHeaders": { "type": "boolean" }, "tlsProfile": { "type": "string" }, "userAgent": { "type": ["string", "null"] } }, "required": ["tlsProfile", "emulateHeaders"], "type": "object" };
function validate20(data, { instancePath = "", parentData, parentDataProperty, rootData = data } = {}) {
  ;
  let vErrors = null;
  let errors = 0;
  if (errors === 0) {
    if (data && typeof data == "object" && !Array.isArray(data)) {
      let missing0;
      if (data.contextId === void 0 && (missing0 = "contextId") || data.partition === void 0 && (missing0 = "partition") || data.expiresAtMs === void 0 && (missing0 = "expiresAtMs") || data.revision === void 0 && (missing0 = "revision") || data.cookieMode === void 0 && (missing0 = "cookieMode") || data.identity === void 0 && (missing0 = "identity")) {
        validate20.errors = [{ instancePath, schemaPath: "#/required", keyword: "required", params: { missingProperty: missing0 }, message: "must have required property '" + missing0 + "'" }];
        return false;
      } else {
        if (data.contextId !== void 0) {
          const _errs1 = errors;
          if (typeof data.contextId !== "string") {
            validate20.errors = [{ instancePath: instancePath + "/contextId", schemaPath: "#/properties/contextId/type", keyword: "type", params: { type: "string" }, message: "must be string" }];
            return false;
          }
          var valid0 = _errs1 === errors;
        } else {
          var valid0 = true;
        }
        if (valid0) {
          if (data.cookieMode !== void 0) {
            let data1 = data.cookieMode;
            const _errs3 = errors;
            if (typeof data1 !== "string") {
              validate20.errors = [{ instancePath: instancePath + "/cookieMode", schemaPath: "#/definitions/CookieMode/type", keyword: "type", params: { type: "string" }, message: "must be string" }];
              return false;
            }
            if (!(data1 === "external" || data1 === "managed")) {
              validate20.errors = [{ instancePath: instancePath + "/cookieMode", schemaPath: "#/definitions/CookieMode/enum", keyword: "enum", params: { allowedValues: schema28.enum }, message: "must be equal to one of the allowed values" }];
              return false;
            }
            var valid0 = _errs3 === errors;
          } else {
            var valid0 = true;
          }
          if (valid0) {
            if (data.expiresAtMs !== void 0) {
              let data2 = data.expiresAtMs;
              const _errs6 = errors;
              if (!(typeof data2 == "number" && (!(data2 % 1) && !isNaN(data2)) && isFinite(data2))) {
                validate20.errors = [{ instancePath: instancePath + "/expiresAtMs", schemaPath: "#/properties/expiresAtMs/type", keyword: "type", params: { type: "integer" }, message: "must be integer" }];
                return false;
              }
              if (errors === _errs6) {
                if (typeof data2 == "number" && isFinite(data2)) {
                  if (data2 > 9007199254740991 || isNaN(data2)) {
                    validate20.errors = [{ instancePath: instancePath + "/expiresAtMs", schemaPath: "#/properties/expiresAtMs/maximum", keyword: "maximum", params: { comparison: "<=", limit: 9007199254740991 }, message: "must be <= 9007199254740991" }];
                    return false;
                  } else {
                    if (data2 < 0 || isNaN(data2)) {
                      validate20.errors = [{ instancePath: instancePath + "/expiresAtMs", schemaPath: "#/properties/expiresAtMs/minimum", keyword: "minimum", params: { comparison: ">=", limit: 0 }, message: "must be >= 0" }];
                      return false;
                    }
                  }
                }
              }
              var valid0 = _errs6 === errors;
            } else {
              var valid0 = true;
            }
            if (valid0) {
              if (data.identity !== void 0) {
                let data3 = data.identity;
                const _errs8 = errors;
                const _errs9 = errors;
                if (errors === _errs9) {
                  if (data3 && typeof data3 == "object" && !Array.isArray(data3)) {
                    let missing1;
                    if (data3.tlsProfile === void 0 && (missing1 = "tlsProfile") || data3.emulateHeaders === void 0 && (missing1 = "emulateHeaders")) {
                      validate20.errors = [{ instancePath: instancePath + "/identity", schemaPath: "#/definitions/BrowserIdentity/required", keyword: "required", params: { missingProperty: missing1 }, message: "must have required property '" + missing1 + "'" }];
                      return false;
                    } else {
                      const _errs11 = errors;
                      for (const key0 in data3) {
                        if (!(key0 === "emulateHeaders" || key0 === "tlsProfile" || key0 === "userAgent")) {
                          validate20.errors = [{ instancePath: instancePath + "/identity", schemaPath: "#/definitions/BrowserIdentity/additionalProperties", keyword: "additionalProperties", params: { additionalProperty: key0 }, message: "must NOT have additional properties" }];
                          return false;
                          break;
                        }
                      }
                      if (_errs11 === errors) {
                        if (data3.emulateHeaders !== void 0) {
                          const _errs12 = errors;
                          if (typeof data3.emulateHeaders !== "boolean") {
                            validate20.errors = [{ instancePath: instancePath + "/identity/emulateHeaders", schemaPath: "#/definitions/BrowserIdentity/properties/emulateHeaders/type", keyword: "type", params: { type: "boolean" }, message: "must be boolean" }];
                            return false;
                          }
                          var valid3 = _errs12 === errors;
                        } else {
                          var valid3 = true;
                        }
                        if (valid3) {
                          if (data3.tlsProfile !== void 0) {
                            const _errs14 = errors;
                            if (typeof data3.tlsProfile !== "string") {
                              validate20.errors = [{ instancePath: instancePath + "/identity/tlsProfile", schemaPath: "#/definitions/BrowserIdentity/properties/tlsProfile/type", keyword: "type", params: { type: "string" }, message: "must be string" }];
                              return false;
                            }
                            var valid3 = _errs14 === errors;
                          } else {
                            var valid3 = true;
                          }
                          if (valid3) {
                            if (data3.userAgent !== void 0) {
                              let data6 = data3.userAgent;
                              const _errs16 = errors;
                              if (typeof data6 !== "string" && data6 !== null) {
                                validate20.errors = [{ instancePath: instancePath + "/identity/userAgent", schemaPath: "#/definitions/BrowserIdentity/properties/userAgent/type", keyword: "type", params: { type: schema29.properties.userAgent.type }, message: "must be string,null" }];
                                return false;
                              }
                              var valid3 = _errs16 === errors;
                            } else {
                              var valid3 = true;
                            }
                          }
                        }
                      }
                    }
                  } else {
                    validate20.errors = [{ instancePath: instancePath + "/identity", schemaPath: "#/definitions/BrowserIdentity/type", keyword: "type", params: { type: "object" }, message: "must be object" }];
                    return false;
                  }
                }
                var valid0 = _errs8 === errors;
              } else {
                var valid0 = true;
              }
              if (valid0) {
                if (data.partition !== void 0) {
                  const _errs18 = errors;
                  if (typeof data.partition !== "string") {
                    validate20.errors = [{ instancePath: instancePath + "/partition", schemaPath: "#/properties/partition/type", keyword: "type", params: { type: "string" }, message: "must be string" }];
                    return false;
                  }
                  var valid0 = _errs18 === errors;
                } else {
                  var valid0 = true;
                }
                if (valid0) {
                  if (data.revision !== void 0) {
                    let data8 = data.revision;
                    const _errs20 = errors;
                    if (!(typeof data8 == "number" && (!(data8 % 1) && !isNaN(data8)) && isFinite(data8))) {
                      validate20.errors = [{ instancePath: instancePath + "/revision", schemaPath: "#/properties/revision/type", keyword: "type", params: { type: "integer" }, message: "must be integer" }];
                      return false;
                    }
                    if (errors === _errs20) {
                      if (typeof data8 == "number" && isFinite(data8)) {
                        if (data8 > 9007199254740991 || isNaN(data8)) {
                          validate20.errors = [{ instancePath: instancePath + "/revision", schemaPath: "#/properties/revision/maximum", keyword: "maximum", params: { comparison: "<=", limit: 9007199254740991 }, message: "must be <= 9007199254740991" }];
                          return false;
                        } else {
                          if (data8 < 0 || isNaN(data8)) {
                            validate20.errors = [{ instancePath: instancePath + "/revision", schemaPath: "#/properties/revision/minimum", keyword: "minimum", params: { comparison: ">=", limit: 0 }, message: "must be >= 0" }];
                            return false;
                          }
                        }
                      }
                    }
                    var valid0 = _errs20 === errors;
                  } else {
                    var valid0 = true;
                  }
                }
              }
            }
          }
        }
      }
    } else {
      validate20.errors = [{ instancePath, schemaPath: "#/type", keyword: "type", params: { type: "object" }, message: "must be object" }];
      return false;
    }
  }
  validate20.errors = vErrors;
  return errors === 0;
}
var cookieRecord = validate21;
var schema30 = { "$id": "https://ja3proxy.invalid/contracts/cookieRecord.schema.json", "$schema": "http://json-schema.org/draft-07/schema#", "additionalProperties": false, "definitions": { "CookieSameSite": { "enum": ["Strict", "Lax", "None"], "type": "string" } }, "properties": { "domain": { "type": "string" }, "expiresAtMs": { "format": "uint64", "minimum": 0, "type": ["integer", "null"], "maximum": 9007199254740991 }, "hostOnly": { "type": "boolean" }, "httpOnly": { "type": "boolean" }, "name": { "type": "string" }, "partitioned": { "type": "boolean" }, "path": { "type": "string" }, "sameSite": { "anyOf": [{ "$ref": "#/definitions/CookieSameSite" }, { "type": "null" }] }, "secure": { "type": "boolean" }, "value": { "type": "string" } }, "required": ["name", "value", "domain", "path", "secure", "httpOnly", "hostOnly", "partitioned"], "title": "CookieRecord", "type": "object" };
var schema31 = { "enum": ["Strict", "Lax", "None"], "type": "string" };
function validate21(data, { instancePath = "", parentData, parentDataProperty, rootData = data } = {}) {
  ;
  let vErrors = null;
  let errors = 0;
  if (errors === 0) {
    if (data && typeof data == "object" && !Array.isArray(data)) {
      let missing0;
      if (data.name === void 0 && (missing0 = "name") || data.value === void 0 && (missing0 = "value") || data.domain === void 0 && (missing0 = "domain") || data.path === void 0 && (missing0 = "path") || data.secure === void 0 && (missing0 = "secure") || data.httpOnly === void 0 && (missing0 = "httpOnly") || data.hostOnly === void 0 && (missing0 = "hostOnly") || data.partitioned === void 0 && (missing0 = "partitioned")) {
        validate21.errors = [{ instancePath, schemaPath: "#/required", keyword: "required", params: { missingProperty: missing0 }, message: "must have required property '" + missing0 + "'" }];
        return false;
      } else {
        const _errs1 = errors;
        for (const key0 in data) {
          if (!func2.call(schema30.properties, key0)) {
            validate21.errors = [{ instancePath, schemaPath: "#/additionalProperties", keyword: "additionalProperties", params: { additionalProperty: key0 }, message: "must NOT have additional properties" }];
            return false;
            break;
          }
        }
        if (_errs1 === errors) {
          if (data.domain !== void 0) {
            const _errs2 = errors;
            if (typeof data.domain !== "string") {
              validate21.errors = [{ instancePath: instancePath + "/domain", schemaPath: "#/properties/domain/type", keyword: "type", params: { type: "string" }, message: "must be string" }];
              return false;
            }
            var valid0 = _errs2 === errors;
          } else {
            var valid0 = true;
          }
          if (valid0) {
            if (data.expiresAtMs !== void 0) {
              let data1 = data.expiresAtMs;
              const _errs4 = errors;
              if (!(typeof data1 == "number" && (!(data1 % 1) && !isNaN(data1)) && isFinite(data1)) && data1 !== null) {
                validate21.errors = [{ instancePath: instancePath + "/expiresAtMs", schemaPath: "#/properties/expiresAtMs/type", keyword: "type", params: { type: schema30.properties.expiresAtMs.type }, message: "must be integer,null" }];
                return false;
              }
              if (errors === _errs4) {
                if (typeof data1 == "number" && isFinite(data1)) {
                  if (data1 > 9007199254740991 || isNaN(data1)) {
                    validate21.errors = [{ instancePath: instancePath + "/expiresAtMs", schemaPath: "#/properties/expiresAtMs/maximum", keyword: "maximum", params: { comparison: "<=", limit: 9007199254740991 }, message: "must be <= 9007199254740991" }];
                    return false;
                  } else {
                    if (data1 < 0 || isNaN(data1)) {
                      validate21.errors = [{ instancePath: instancePath + "/expiresAtMs", schemaPath: "#/properties/expiresAtMs/minimum", keyword: "minimum", params: { comparison: ">=", limit: 0 }, message: "must be >= 0" }];
                      return false;
                    }
                  }
                }
              }
              var valid0 = _errs4 === errors;
            } else {
              var valid0 = true;
            }
            if (valid0) {
              if (data.hostOnly !== void 0) {
                const _errs6 = errors;
                if (typeof data.hostOnly !== "boolean") {
                  validate21.errors = [{ instancePath: instancePath + "/hostOnly", schemaPath: "#/properties/hostOnly/type", keyword: "type", params: { type: "boolean" }, message: "must be boolean" }];
                  return false;
                }
                var valid0 = _errs6 === errors;
              } else {
                var valid0 = true;
              }
              if (valid0) {
                if (data.httpOnly !== void 0) {
                  const _errs8 = errors;
                  if (typeof data.httpOnly !== "boolean") {
                    validate21.errors = [{ instancePath: instancePath + "/httpOnly", schemaPath: "#/properties/httpOnly/type", keyword: "type", params: { type: "boolean" }, message: "must be boolean" }];
                    return false;
                  }
                  var valid0 = _errs8 === errors;
                } else {
                  var valid0 = true;
                }
                if (valid0) {
                  if (data.name !== void 0) {
                    const _errs10 = errors;
                    if (typeof data.name !== "string") {
                      validate21.errors = [{ instancePath: instancePath + "/name", schemaPath: "#/properties/name/type", keyword: "type", params: { type: "string" }, message: "must be string" }];
                      return false;
                    }
                    var valid0 = _errs10 === errors;
                  } else {
                    var valid0 = true;
                  }
                  if (valid0) {
                    if (data.partitioned !== void 0) {
                      const _errs12 = errors;
                      if (typeof data.partitioned !== "boolean") {
                        validate21.errors = [{ instancePath: instancePath + "/partitioned", schemaPath: "#/properties/partitioned/type", keyword: "type", params: { type: "boolean" }, message: "must be boolean" }];
                        return false;
                      }
                      var valid0 = _errs12 === errors;
                    } else {
                      var valid0 = true;
                    }
                    if (valid0) {
                      if (data.path !== void 0) {
                        const _errs14 = errors;
                        if (typeof data.path !== "string") {
                          validate21.errors = [{ instancePath: instancePath + "/path", schemaPath: "#/properties/path/type", keyword: "type", params: { type: "string" }, message: "must be string" }];
                          return false;
                        }
                        var valid0 = _errs14 === errors;
                      } else {
                        var valid0 = true;
                      }
                      if (valid0) {
                        if (data.sameSite !== void 0) {
                          let data7 = data.sameSite;
                          const _errs16 = errors;
                          const _errs17 = errors;
                          let valid1 = false;
                          const _errs18 = errors;
                          if (typeof data7 !== "string") {
                            const err0 = { instancePath: instancePath + "/sameSite", schemaPath: "#/definitions/CookieSameSite/type", keyword: "type", params: { type: "string" }, message: "must be string" };
                            if (vErrors === null) {
                              vErrors = [err0];
                            } else {
                              vErrors.push(err0);
                            }
                            errors++;
                          }
                          if (!(data7 === "Strict" || data7 === "Lax" || data7 === "None")) {
                            const err1 = { instancePath: instancePath + "/sameSite", schemaPath: "#/definitions/CookieSameSite/enum", keyword: "enum", params: { allowedValues: schema31.enum }, message: "must be equal to one of the allowed values" };
                            if (vErrors === null) {
                              vErrors = [err1];
                            } else {
                              vErrors.push(err1);
                            }
                            errors++;
                          }
                          var _valid0 = _errs18 === errors;
                          valid1 = valid1 || _valid0;
                          if (!valid1) {
                            const _errs21 = errors;
                            if (data7 !== null) {
                              const err2 = { instancePath: instancePath + "/sameSite", schemaPath: "#/properties/sameSite/anyOf/1/type", keyword: "type", params: { type: "null" }, message: "must be null" };
                              if (vErrors === null) {
                                vErrors = [err2];
                              } else {
                                vErrors.push(err2);
                              }
                              errors++;
                            }
                            var _valid0 = _errs21 === errors;
                            valid1 = valid1 || _valid0;
                          }
                          if (!valid1) {
                            const err3 = { instancePath: instancePath + "/sameSite", schemaPath: "#/properties/sameSite/anyOf", keyword: "anyOf", params: {}, message: "must match a schema in anyOf" };
                            if (vErrors === null) {
                              vErrors = [err3];
                            } else {
                              vErrors.push(err3);
                            }
                            errors++;
                            validate21.errors = vErrors;
                            return false;
                          } else {
                            errors = _errs17;
                            if (vErrors !== null) {
                              if (_errs17) {
                                vErrors.length = _errs17;
                              } else {
                                vErrors = null;
                              }
                            }
                          }
                          var valid0 = _errs16 === errors;
                        } else {
                          var valid0 = true;
                        }
                        if (valid0) {
                          if (data.secure !== void 0) {
                            const _errs23 = errors;
                            if (typeof data.secure !== "boolean") {
                              validate21.errors = [{ instancePath: instancePath + "/secure", schemaPath: "#/properties/secure/type", keyword: "type", params: { type: "boolean" }, message: "must be boolean" }];
                              return false;
                            }
                            var valid0 = _errs23 === errors;
                          } else {
                            var valid0 = true;
                          }
                          if (valid0) {
                            if (data.value !== void 0) {
                              const _errs25 = errors;
                              if (typeof data.value !== "string") {
                                validate21.errors = [{ instancePath: instancePath + "/value", schemaPath: "#/properties/value/type", keyword: "type", params: { type: "string" }, message: "must be string" }];
                                return false;
                              }
                              var valid0 = _errs25 === errors;
                            } else {
                              var valid0 = true;
                            }
                          }
                        }
                      }
                    }
                  }
                }
              }
            }
          }
        }
      }
    } else {
      validate21.errors = [{ instancePath, schemaPath: "#/type", keyword: "type", params: { type: "object" }, message: "must be object" }];
      return false;
    }
  }
  validate21.errors = vErrors;
  return errors === 0;
}
var cookieSnapshot = validate22;
var schema33 = { "additionalProperties": false, "properties": { "domain": { "type": "string" }, "expiresAtMs": { "format": "uint64", "minimum": 0, "type": ["integer", "null"], "maximum": 9007199254740991 }, "hostOnly": { "type": "boolean" }, "httpOnly": { "type": "boolean" }, "name": { "type": "string" }, "partitioned": { "type": "boolean" }, "path": { "type": "string" }, "sameSite": { "anyOf": [{ "$ref": "#/definitions/CookieSameSite" }, { "type": "null" }] }, "secure": { "type": "boolean" }, "value": { "type": "string" } }, "required": ["name", "value", "domain", "path", "secure", "httpOnly", "hostOnly", "partitioned"], "type": "object" };
var schema34 = { "enum": ["Strict", "Lax", "None"], "type": "string" };
function validate23(data, { instancePath = "", parentData, parentDataProperty, rootData = data } = {}) {
  let vErrors = null;
  let errors = 0;
  if (errors === 0) {
    if (data && typeof data == "object" && !Array.isArray(data)) {
      let missing0;
      if (data.name === void 0 && (missing0 = "name") || data.value === void 0 && (missing0 = "value") || data.domain === void 0 && (missing0 = "domain") || data.path === void 0 && (missing0 = "path") || data.secure === void 0 && (missing0 = "secure") || data.httpOnly === void 0 && (missing0 = "httpOnly") || data.hostOnly === void 0 && (missing0 = "hostOnly") || data.partitioned === void 0 && (missing0 = "partitioned")) {
        validate23.errors = [{ instancePath, schemaPath: "#/required", keyword: "required", params: { missingProperty: missing0 }, message: "must have required property '" + missing0 + "'" }];
        return false;
      } else {
        const _errs1 = errors;
        for (const key0 in data) {
          if (!func2.call(schema33.properties, key0)) {
            validate23.errors = [{ instancePath, schemaPath: "#/additionalProperties", keyword: "additionalProperties", params: { additionalProperty: key0 }, message: "must NOT have additional properties" }];
            return false;
            break;
          }
        }
        if (_errs1 === errors) {
          if (data.domain !== void 0) {
            const _errs2 = errors;
            if (typeof data.domain !== "string") {
              validate23.errors = [{ instancePath: instancePath + "/domain", schemaPath: "#/properties/domain/type", keyword: "type", params: { type: "string" }, message: "must be string" }];
              return false;
            }
            var valid0 = _errs2 === errors;
          } else {
            var valid0 = true;
          }
          if (valid0) {
            if (data.expiresAtMs !== void 0) {
              let data1 = data.expiresAtMs;
              const _errs4 = errors;
              if (!(typeof data1 == "number" && (!(data1 % 1) && !isNaN(data1)) && isFinite(data1)) && data1 !== null) {
                validate23.errors = [{ instancePath: instancePath + "/expiresAtMs", schemaPath: "#/properties/expiresAtMs/type", keyword: "type", params: { type: schema33.properties.expiresAtMs.type }, message: "must be integer,null" }];
                return false;
              }
              if (errors === _errs4) {
                if (typeof data1 == "number" && isFinite(data1)) {
                  if (data1 > 9007199254740991 || isNaN(data1)) {
                    validate23.errors = [{ instancePath: instancePath + "/expiresAtMs", schemaPath: "#/properties/expiresAtMs/maximum", keyword: "maximum", params: { comparison: "<=", limit: 9007199254740991 }, message: "must be <= 9007199254740991" }];
                    return false;
                  } else {
                    if (data1 < 0 || isNaN(data1)) {
                      validate23.errors = [{ instancePath: instancePath + "/expiresAtMs", schemaPath: "#/properties/expiresAtMs/minimum", keyword: "minimum", params: { comparison: ">=", limit: 0 }, message: "must be >= 0" }];
                      return false;
                    }
                  }
                }
              }
              var valid0 = _errs4 === errors;
            } else {
              var valid0 = true;
            }
            if (valid0) {
              if (data.hostOnly !== void 0) {
                const _errs6 = errors;
                if (typeof data.hostOnly !== "boolean") {
                  validate23.errors = [{ instancePath: instancePath + "/hostOnly", schemaPath: "#/properties/hostOnly/type", keyword: "type", params: { type: "boolean" }, message: "must be boolean" }];
                  return false;
                }
                var valid0 = _errs6 === errors;
              } else {
                var valid0 = true;
              }
              if (valid0) {
                if (data.httpOnly !== void 0) {
                  const _errs8 = errors;
                  if (typeof data.httpOnly !== "boolean") {
                    validate23.errors = [{ instancePath: instancePath + "/httpOnly", schemaPath: "#/properties/httpOnly/type", keyword: "type", params: { type: "boolean" }, message: "must be boolean" }];
                    return false;
                  }
                  var valid0 = _errs8 === errors;
                } else {
                  var valid0 = true;
                }
                if (valid0) {
                  if (data.name !== void 0) {
                    const _errs10 = errors;
                    if (typeof data.name !== "string") {
                      validate23.errors = [{ instancePath: instancePath + "/name", schemaPath: "#/properties/name/type", keyword: "type", params: { type: "string" }, message: "must be string" }];
                      return false;
                    }
                    var valid0 = _errs10 === errors;
                  } else {
                    var valid0 = true;
                  }
                  if (valid0) {
                    if (data.partitioned !== void 0) {
                      const _errs12 = errors;
                      if (typeof data.partitioned !== "boolean") {
                        validate23.errors = [{ instancePath: instancePath + "/partitioned", schemaPath: "#/properties/partitioned/type", keyword: "type", params: { type: "boolean" }, message: "must be boolean" }];
                        return false;
                      }
                      var valid0 = _errs12 === errors;
                    } else {
                      var valid0 = true;
                    }
                    if (valid0) {
                      if (data.path !== void 0) {
                        const _errs14 = errors;
                        if (typeof data.path !== "string") {
                          validate23.errors = [{ instancePath: instancePath + "/path", schemaPath: "#/properties/path/type", keyword: "type", params: { type: "string" }, message: "must be string" }];
                          return false;
                        }
                        var valid0 = _errs14 === errors;
                      } else {
                        var valid0 = true;
                      }
                      if (valid0) {
                        if (data.sameSite !== void 0) {
                          let data7 = data.sameSite;
                          const _errs16 = errors;
                          const _errs17 = errors;
                          let valid1 = false;
                          const _errs18 = errors;
                          if (typeof data7 !== "string") {
                            const err0 = { instancePath: instancePath + "/sameSite", schemaPath: "#/definitions/CookieSameSite/type", keyword: "type", params: { type: "string" }, message: "must be string" };
                            if (vErrors === null) {
                              vErrors = [err0];
                            } else {
                              vErrors.push(err0);
                            }
                            errors++;
                          }
                          if (!(data7 === "Strict" || data7 === "Lax" || data7 === "None")) {
                            const err1 = { instancePath: instancePath + "/sameSite", schemaPath: "#/definitions/CookieSameSite/enum", keyword: "enum", params: { allowedValues: schema34.enum }, message: "must be equal to one of the allowed values" };
                            if (vErrors === null) {
                              vErrors = [err1];
                            } else {
                              vErrors.push(err1);
                            }
                            errors++;
                          }
                          var _valid0 = _errs18 === errors;
                          valid1 = valid1 || _valid0;
                          if (!valid1) {
                            const _errs21 = errors;
                            if (data7 !== null) {
                              const err2 = { instancePath: instancePath + "/sameSite", schemaPath: "#/properties/sameSite/anyOf/1/type", keyword: "type", params: { type: "null" }, message: "must be null" };
                              if (vErrors === null) {
                                vErrors = [err2];
                              } else {
                                vErrors.push(err2);
                              }
                              errors++;
                            }
                            var _valid0 = _errs21 === errors;
                            valid1 = valid1 || _valid0;
                          }
                          if (!valid1) {
                            const err3 = { instancePath: instancePath + "/sameSite", schemaPath: "#/properties/sameSite/anyOf", keyword: "anyOf", params: {}, message: "must match a schema in anyOf" };
                            if (vErrors === null) {
                              vErrors = [err3];
                            } else {
                              vErrors.push(err3);
                            }
                            errors++;
                            validate23.errors = vErrors;
                            return false;
                          } else {
                            errors = _errs17;
                            if (vErrors !== null) {
                              if (_errs17) {
                                vErrors.length = _errs17;
                              } else {
                                vErrors = null;
                              }
                            }
                          }
                          var valid0 = _errs16 === errors;
                        } else {
                          var valid0 = true;
                        }
                        if (valid0) {
                          if (data.secure !== void 0) {
                            const _errs23 = errors;
                            if (typeof data.secure !== "boolean") {
                              validate23.errors = [{ instancePath: instancePath + "/secure", schemaPath: "#/properties/secure/type", keyword: "type", params: { type: "boolean" }, message: "must be boolean" }];
                              return false;
                            }
                            var valid0 = _errs23 === errors;
                          } else {
                            var valid0 = true;
                          }
                          if (valid0) {
                            if (data.value !== void 0) {
                              const _errs25 = errors;
                              if (typeof data.value !== "string") {
                                validate23.errors = [{ instancePath: instancePath + "/value", schemaPath: "#/properties/value/type", keyword: "type", params: { type: "string" }, message: "must be string" }];
                                return false;
                              }
                              var valid0 = _errs25 === errors;
                            } else {
                              var valid0 = true;
                            }
                          }
                        }
                      }
                    }
                  }
                }
              }
            }
          }
        }
      }
    } else {
      validate23.errors = [{ instancePath, schemaPath: "#/type", keyword: "type", params: { type: "object" }, message: "must be object" }];
      return false;
    }
  }
  validate23.errors = vErrors;
  return errors === 0;
}
function validate22(data, { instancePath = "", parentData, parentDataProperty, rootData = data } = {}) {
  ;
  let vErrors = null;
  let errors = 0;
  if (errors === 0) {
    if (data && typeof data == "object" && !Array.isArray(data)) {
      let missing0;
      if (data.partitionKey === void 0 && (missing0 = "partitionKey") || data.cookies === void 0 && (missing0 = "cookies")) {
        validate22.errors = [{ instancePath, schemaPath: "#/required", keyword: "required", params: { missingProperty: missing0 }, message: "must have required property '" + missing0 + "'" }];
        return false;
      } else {
        const _errs1 = errors;
        for (const key0 in data) {
          if (!(key0 === "cookies" || key0 === "partitionKey")) {
            validate22.errors = [{ instancePath, schemaPath: "#/additionalProperties", keyword: "additionalProperties", params: { additionalProperty: key0 }, message: "must NOT have additional properties" }];
            return false;
            break;
          }
        }
        if (_errs1 === errors) {
          if (data.cookies !== void 0) {
            let data0 = data.cookies;
            const _errs2 = errors;
            if (errors === _errs2) {
              if (Array.isArray(data0)) {
                var valid1 = true;
                const len0 = data0.length;
                for (let i0 = 0; i0 < len0; i0++) {
                  const _errs4 = errors;
                  if (!validate23(data0[i0], { instancePath: instancePath + "/cookies/" + i0, parentData: data0, parentDataProperty: i0, rootData })) {
                    vErrors = vErrors === null ? validate23.errors : vErrors.concat(validate23.errors);
                    errors = vErrors.length;
                  }
                  var valid1 = _errs4 === errors;
                  if (!valid1) {
                    break;
                  }
                }
              } else {
                validate22.errors = [{ instancePath: instancePath + "/cookies", schemaPath: "#/properties/cookies/type", keyword: "type", params: { type: "array" }, message: "must be array" }];
                return false;
              }
            }
            var valid0 = _errs2 === errors;
          } else {
            var valid0 = true;
          }
          if (valid0) {
            if (data.partitionKey !== void 0) {
              const _errs5 = errors;
              if (typeof data.partitionKey !== "string") {
                validate22.errors = [{ instancePath: instancePath + "/partitionKey", schemaPath: "#/properties/partitionKey/type", keyword: "type", params: { type: "string" }, message: "must be string" }];
                return false;
              }
              var valid0 = _errs5 === errors;
            } else {
              var valid0 = true;
            }
          }
        }
      }
    } else {
      validate22.errors = [{ instancePath, schemaPath: "#/type", keyword: "type", params: { type: "object" }, message: "must be object" }];
      return false;
    }
  }
  validate22.errors = vErrors;
  return errors === 0;
}
var capabilities = validate25;
var schema40 = { "enum": ["ja3proxy"], "type": "string" };
function validate25(data, { instancePath = "", parentData, parentDataProperty, rootData = data } = {}) {
  ;
  let vErrors = null;
  let errors = 0;
  if (errors === 0) {
    if (data && typeof data == "object" && !Array.isArray(data)) {
      let missing0;
      if (data.service === void 0 && (missing0 = "service") || data.build === void 0 && (missing0 = "build") || data.profiles === void 0 && (missing0 = "profiles") || data.headerDescriptors === void 0 && (missing0 = "headerDescriptors") || data.framing === void 0 && (missing0 = "framing") || data.limits === void 0 && (missing0 = "limits") || data.modes === void 0 && (missing0 = "modes")) {
        validate25.errors = [{ instancePath, schemaPath: "#/required", keyword: "required", params: { missingProperty: missing0 }, message: "must have required property '" + missing0 + "'" }];
        return false;
      } else {
        if (data.build !== void 0) {
          const _errs1 = errors;
          if (typeof data.build !== "string") {
            validate25.errors = [{ instancePath: instancePath + "/build", schemaPath: "#/properties/build/type", keyword: "type", params: { type: "string" }, message: "must be string" }];
            return false;
          }
          var valid0 = _errs1 === errors;
        } else {
          var valid0 = true;
        }
        if (valid0) {
          if (data.framing !== void 0) {
            let data1 = data.framing;
            const _errs3 = errors;
            const _errs4 = errors;
            if (errors === _errs4) {
              if (data1 && typeof data1 == "object" && !Array.isArray(data1)) {
                let missing1;
                if (data1.contentType === void 0 && (missing1 = "contentType") || data1.maxMetadataBytes === void 0 && (missing1 = "maxMetadataBytes") || data1.maxDataBytes === void 0 && (missing1 = "maxDataBytes") || data1.maxUploadFrames === void 0 && (missing1 = "maxUploadFrames")) {
                  validate25.errors = [{ instancePath: instancePath + "/framing", schemaPath: "#/definitions/FramingCapabilities/required", keyword: "required", params: { missingProperty: missing1 }, message: "must have required property '" + missing1 + "'" }];
                  return false;
                } else {
                  if (data1.contentType !== void 0) {
                    const _errs6 = errors;
                    if (typeof data1.contentType !== "string") {
                      validate25.errors = [{ instancePath: instancePath + "/framing/contentType", schemaPath: "#/definitions/FramingCapabilities/properties/contentType/type", keyword: "type", params: { type: "string" }, message: "must be string" }];
                      return false;
                    }
                    var valid2 = _errs6 === errors;
                  } else {
                    var valid2 = true;
                  }
                  if (valid2) {
                    if (data1.maxDataBytes !== void 0) {
                      let data3 = data1.maxDataBytes;
                      const _errs8 = errors;
                      if (!(typeof data3 == "number" && (!(data3 % 1) && !isNaN(data3)) && isFinite(data3))) {
                        validate25.errors = [{ instancePath: instancePath + "/framing/maxDataBytes", schemaPath: "#/definitions/FramingCapabilities/properties/maxDataBytes/type", keyword: "type", params: { type: "integer" }, message: "must be integer" }];
                        return false;
                      }
                      if (errors === _errs8) {
                        if (typeof data3 == "number" && isFinite(data3)) {
                          if (data3 > 9007199254740991 || isNaN(data3)) {
                            validate25.errors = [{ instancePath: instancePath + "/framing/maxDataBytes", schemaPath: "#/definitions/FramingCapabilities/properties/maxDataBytes/maximum", keyword: "maximum", params: { comparison: "<=", limit: 9007199254740991 }, message: "must be <= 9007199254740991" }];
                            return false;
                          } else {
                            if (data3 < 0 || isNaN(data3)) {
                              validate25.errors = [{ instancePath: instancePath + "/framing/maxDataBytes", schemaPath: "#/definitions/FramingCapabilities/properties/maxDataBytes/minimum", keyword: "minimum", params: { comparison: ">=", limit: 0 }, message: "must be >= 0" }];
                              return false;
                            }
                          }
                        }
                      }
                      var valid2 = _errs8 === errors;
                    } else {
                      var valid2 = true;
                    }
                    if (valid2) {
                      if (data1.maxMetadataBytes !== void 0) {
                        let data4 = data1.maxMetadataBytes;
                        const _errs10 = errors;
                        if (!(typeof data4 == "number" && (!(data4 % 1) && !isNaN(data4)) && isFinite(data4))) {
                          validate25.errors = [{ instancePath: instancePath + "/framing/maxMetadataBytes", schemaPath: "#/definitions/FramingCapabilities/properties/maxMetadataBytes/type", keyword: "type", params: { type: "integer" }, message: "must be integer" }];
                          return false;
                        }
                        if (errors === _errs10) {
                          if (typeof data4 == "number" && isFinite(data4)) {
                            if (data4 > 9007199254740991 || isNaN(data4)) {
                              validate25.errors = [{ instancePath: instancePath + "/framing/maxMetadataBytes", schemaPath: "#/definitions/FramingCapabilities/properties/maxMetadataBytes/maximum", keyword: "maximum", params: { comparison: "<=", limit: 9007199254740991 }, message: "must be <= 9007199254740991" }];
                              return false;
                            } else {
                              if (data4 < 0 || isNaN(data4)) {
                                validate25.errors = [{ instancePath: instancePath + "/framing/maxMetadataBytes", schemaPath: "#/definitions/FramingCapabilities/properties/maxMetadataBytes/minimum", keyword: "minimum", params: { comparison: ">=", limit: 0 }, message: "must be >= 0" }];
                                return false;
                              }
                            }
                          }
                        }
                        var valid2 = _errs10 === errors;
                      } else {
                        var valid2 = true;
                      }
                      if (valid2) {
                        if (data1.maxUploadFrames !== void 0) {
                          let data5 = data1.maxUploadFrames;
                          const _errs12 = errors;
                          if (!(typeof data5 == "number" && (!(data5 % 1) && !isNaN(data5)) && isFinite(data5))) {
                            validate25.errors = [{ instancePath: instancePath + "/framing/maxUploadFrames", schemaPath: "#/definitions/FramingCapabilities/properties/maxUploadFrames/type", keyword: "type", params: { type: "integer" }, message: "must be integer" }];
                            return false;
                          }
                          if (errors === _errs12) {
                            if (typeof data5 == "number" && isFinite(data5)) {
                              if (data5 > 9007199254740991 || isNaN(data5)) {
                                validate25.errors = [{ instancePath: instancePath + "/framing/maxUploadFrames", schemaPath: "#/definitions/FramingCapabilities/properties/maxUploadFrames/maximum", keyword: "maximum", params: { comparison: "<=", limit: 9007199254740991 }, message: "must be <= 9007199254740991" }];
                                return false;
                              } else {
                                if (data5 < 0 || isNaN(data5)) {
                                  validate25.errors = [{ instancePath: instancePath + "/framing/maxUploadFrames", schemaPath: "#/definitions/FramingCapabilities/properties/maxUploadFrames/minimum", keyword: "minimum", params: { comparison: ">=", limit: 0 }, message: "must be >= 0" }];
                                  return false;
                                }
                              }
                            }
                          }
                          var valid2 = _errs12 === errors;
                        } else {
                          var valid2 = true;
                        }
                      }
                    }
                  }
                }
              } else {
                validate25.errors = [{ instancePath: instancePath + "/framing", schemaPath: "#/definitions/FramingCapabilities/type", keyword: "type", params: { type: "object" }, message: "must be object" }];
                return false;
              }
            }
            var valid0 = _errs3 === errors;
          } else {
            var valid0 = true;
          }
          if (valid0) {
            if (data.headerDescriptors !== void 0) {
              let data6 = data.headerDescriptors;
              const _errs14 = errors;
              if (errors === _errs14) {
                if (Array.isArray(data6)) {
                  var valid3 = true;
                  const len0 = data6.length;
                  for (let i0 = 0; i0 < len0; i0++) {
                    let data7 = data6[i0];
                    const _errs16 = errors;
                    const _errs17 = errors;
                    if (errors === _errs17) {
                      if (data7 && typeof data7 == "object" && !Array.isArray(data7)) {
                        let missing2;
                        if (data7.tlsProfile === void 0 && (missing2 = "tlsProfile") || data7.headers === void 0 && (missing2 = "headers")) {
                          validate25.errors = [{ instancePath: instancePath + "/headerDescriptors/" + i0, schemaPath: "#/definitions/HeaderDescriptor/required", keyword: "required", params: { missingProperty: missing2 }, message: "must have required property '" + missing2 + "'" }];
                          return false;
                        } else {
                          if (data7.headers !== void 0) {
                            let data8 = data7.headers;
                            const _errs19 = errors;
                            if (errors === _errs19) {
                              if (Array.isArray(data8)) {
                                var valid6 = true;
                                const len1 = data8.length;
                                for (let i1 = 0; i1 < len1; i1++) {
                                  let data9 = data8[i1];
                                  const _errs21 = errors;
                                  if (errors === _errs21) {
                                    if (Array.isArray(data9)) {
                                      if (data9.length > 2) {
                                        validate25.errors = [{ instancePath: instancePath + "/headerDescriptors/" + i0 + "/headers/" + i1, schemaPath: "#/definitions/HeaderDescriptor/properties/headers/items/maxItems", keyword: "maxItems", params: { limit: 2 }, message: "must NOT have more than 2 items" }];
                                        return false;
                                      } else {
                                        if (data9.length < 2) {
                                          validate25.errors = [{ instancePath: instancePath + "/headerDescriptors/" + i0 + "/headers/" + i1, schemaPath: "#/definitions/HeaderDescriptor/properties/headers/items/minItems", keyword: "minItems", params: { limit: 2 }, message: "must NOT have fewer than 2 items" }];
                                          return false;
                                        } else {
                                          const len2 = data9.length;
                                          if (len2 > 0) {
                                            const _errs23 = errors;
                                            if (typeof data9[0] !== "string") {
                                              validate25.errors = [{ instancePath: instancePath + "/headerDescriptors/" + i0 + "/headers/" + i1 + "/0", schemaPath: "#/definitions/HeaderDescriptor/properties/headers/items/items/0/type", keyword: "type", params: { type: "string" }, message: "must be string" }];
                                              return false;
                                            }
                                            var valid7 = _errs23 === errors;
                                          }
                                          if (valid7) {
                                            if (len2 > 1) {
                                              const _errs25 = errors;
                                              if (typeof data9[1] !== "string") {
                                                validate25.errors = [{ instancePath: instancePath + "/headerDescriptors/" + i0 + "/headers/" + i1 + "/1", schemaPath: "#/definitions/HeaderDescriptor/properties/headers/items/items/1/type", keyword: "type", params: { type: "string" }, message: "must be string" }];
                                                return false;
                                              }
                                              var valid7 = _errs25 === errors;
                                            }
                                          }
                                        }
                                      }
                                    } else {
                                      validate25.errors = [{ instancePath: instancePath + "/headerDescriptors/" + i0 + "/headers/" + i1, schemaPath: "#/definitions/HeaderDescriptor/properties/headers/items/type", keyword: "type", params: { type: "array" }, message: "must be array" }];
                                      return false;
                                    }
                                  }
                                  var valid6 = _errs21 === errors;
                                  if (!valid6) {
                                    break;
                                  }
                                }
                              } else {
                                validate25.errors = [{ instancePath: instancePath + "/headerDescriptors/" + i0 + "/headers", schemaPath: "#/definitions/HeaderDescriptor/properties/headers/type", keyword: "type", params: { type: "array" }, message: "must be array" }];
                                return false;
                              }
                            }
                            var valid5 = _errs19 === errors;
                          } else {
                            var valid5 = true;
                          }
                          if (valid5) {
                            if (data7.tlsProfile !== void 0) {
                              const _errs27 = errors;
                              if (typeof data7.tlsProfile !== "string") {
                                validate25.errors = [{ instancePath: instancePath + "/headerDescriptors/" + i0 + "/tlsProfile", schemaPath: "#/definitions/HeaderDescriptor/properties/tlsProfile/type", keyword: "type", params: { type: "string" }, message: "must be string" }];
                                return false;
                              }
                              var valid5 = _errs27 === errors;
                            } else {
                              var valid5 = true;
                            }
                          }
                        }
                      } else {
                        validate25.errors = [{ instancePath: instancePath + "/headerDescriptors/" + i0, schemaPath: "#/definitions/HeaderDescriptor/type", keyword: "type", params: { type: "object" }, message: "must be object" }];
                        return false;
                      }
                    }
                    var valid3 = _errs16 === errors;
                    if (!valid3) {
                      break;
                    }
                  }
                } else {
                  validate25.errors = [{ instancePath: instancePath + "/headerDescriptors", schemaPath: "#/properties/headerDescriptors/type", keyword: "type", params: { type: "array" }, message: "must be array" }];
                  return false;
                }
              }
              var valid0 = _errs14 === errors;
            } else {
              var valid0 = true;
            }
            if (valid0) {
              if (data.limits !== void 0) {
                let data13 = data.limits;
                const _errs29 = errors;
                const _errs30 = errors;
                if (errors === _errs30) {
                  if (data13 && typeof data13 == "object" && !Array.isArray(data13)) {
                    let missing3;
                    if (data13.maxRequestBytes === void 0 && (missing3 = "maxRequestBytes") || data13.maxResponseBytes === void 0 && (missing3 = "maxResponseBytes") || data13.maxTimeoutMs === void 0 && (missing3 = "maxTimeoutMs") || data13.maxConcurrent === void 0 && (missing3 = "maxConcurrent") || data13.maxConcurrentPerPartition === void 0 && (missing3 = "maxConcurrentPerPartition") || data13.maxQueued === void 0 && (missing3 = "maxQueued") || data13.maxQueuedPerPartition === void 0 && (missing3 = "maxQueuedPerPartition") || data13.maxEnvelopes === void 0 && (missing3 = "maxEnvelopes") || data13.envelopeTimeoutMs === void 0 && (missing3 = "envelopeTimeoutMs") || data13.maxControlBytes === void 0 && (missing3 = "maxControlBytes") || data13.maxHeaderBytes === void 0 && (missing3 = "maxHeaderBytes") || data13.maxHeaders === void 0 && (missing3 = "maxHeaders") || data13.maxContexts === void 0 && (missing3 = "maxContexts") || data13.maxContextsPerPartition === void 0 && (missing3 = "maxContextsPerPartition") || data13.contextIdleTtlMs === void 0 && (missing3 = "contextIdleTtlMs") || data13.contextMaxIdleTtlMs === void 0 && (missing3 = "contextMaxIdleTtlMs") || data13.contextMaxAgeMs === void 0 && (missing3 = "contextMaxAgeMs") || data13.maxCookies === void 0 && (missing3 = "maxCookies") || data13.maxCookieBytes === void 0 && (missing3 = "maxCookieBytes") || data13.maxCookieSize === void 0 && (missing3 = "maxCookieSize") || data13.maxAllowedOrigins === void 0 && (missing3 = "maxAllowedOrigins") || data13.registryCapacity === void 0 && (missing3 = "registryCapacity") || data13.registryTtlMs === void 0 && (missing3 = "registryTtlMs")) {
                      validate25.errors = [{ instancePath: instancePath + "/limits", schemaPath: "#/definitions/CapabilityLimits/required", keyword: "required", params: { missingProperty: missing3 }, message: "must have required property '" + missing3 + "'" }];
                      return false;
                    } else {
                      if (data13.contextIdleTtlMs !== void 0) {
                        let data14 = data13.contextIdleTtlMs;
                        const _errs32 = errors;
                        if (!(typeof data14 == "number" && (!(data14 % 1) && !isNaN(data14)) && isFinite(data14))) {
                          validate25.errors = [{ instancePath: instancePath + "/limits/contextIdleTtlMs", schemaPath: "#/definitions/CapabilityLimits/properties/contextIdleTtlMs/type", keyword: "type", params: { type: "integer" }, message: "must be integer" }];
                          return false;
                        }
                        if (errors === _errs32) {
                          if (typeof data14 == "number" && isFinite(data14)) {
                            if (data14 > 9007199254740991 || isNaN(data14)) {
                              validate25.errors = [{ instancePath: instancePath + "/limits/contextIdleTtlMs", schemaPath: "#/definitions/CapabilityLimits/properties/contextIdleTtlMs/maximum", keyword: "maximum", params: { comparison: "<=", limit: 9007199254740991 }, message: "must be <= 9007199254740991" }];
                              return false;
                            } else {
                              if (data14 < 0 || isNaN(data14)) {
                                validate25.errors = [{ instancePath: instancePath + "/limits/contextIdleTtlMs", schemaPath: "#/definitions/CapabilityLimits/properties/contextIdleTtlMs/minimum", keyword: "minimum", params: { comparison: ">=", limit: 0 }, message: "must be >= 0" }];
                                return false;
                              }
                            }
                          }
                        }
                        var valid9 = _errs32 === errors;
                      } else {
                        var valid9 = true;
                      }
                      if (valid9) {
                        if (data13.contextMaxAgeMs !== void 0) {
                          let data15 = data13.contextMaxAgeMs;
                          const _errs34 = errors;
                          if (!(typeof data15 == "number" && (!(data15 % 1) && !isNaN(data15)) && isFinite(data15))) {
                            validate25.errors = [{ instancePath: instancePath + "/limits/contextMaxAgeMs", schemaPath: "#/definitions/CapabilityLimits/properties/contextMaxAgeMs/type", keyword: "type", params: { type: "integer" }, message: "must be integer" }];
                            return false;
                          }
                          if (errors === _errs34) {
                            if (typeof data15 == "number" && isFinite(data15)) {
                              if (data15 > 9007199254740991 || isNaN(data15)) {
                                validate25.errors = [{ instancePath: instancePath + "/limits/contextMaxAgeMs", schemaPath: "#/definitions/CapabilityLimits/properties/contextMaxAgeMs/maximum", keyword: "maximum", params: { comparison: "<=", limit: 9007199254740991 }, message: "must be <= 9007199254740991" }];
                                return false;
                              } else {
                                if (data15 < 0 || isNaN(data15)) {
                                  validate25.errors = [{ instancePath: instancePath + "/limits/contextMaxAgeMs", schemaPath: "#/definitions/CapabilityLimits/properties/contextMaxAgeMs/minimum", keyword: "minimum", params: { comparison: ">=", limit: 0 }, message: "must be >= 0" }];
                                  return false;
                                }
                              }
                            }
                          }
                          var valid9 = _errs34 === errors;
                        } else {
                          var valid9 = true;
                        }
                        if (valid9) {
                          if (data13.contextMaxIdleTtlMs !== void 0) {
                            let data16 = data13.contextMaxIdleTtlMs;
                            const _errs36 = errors;
                            if (!(typeof data16 == "number" && (!(data16 % 1) && !isNaN(data16)) && isFinite(data16))) {
                              validate25.errors = [{ instancePath: instancePath + "/limits/contextMaxIdleTtlMs", schemaPath: "#/definitions/CapabilityLimits/properties/contextMaxIdleTtlMs/type", keyword: "type", params: { type: "integer" }, message: "must be integer" }];
                              return false;
                            }
                            if (errors === _errs36) {
                              if (typeof data16 == "number" && isFinite(data16)) {
                                if (data16 > 9007199254740991 || isNaN(data16)) {
                                  validate25.errors = [{ instancePath: instancePath + "/limits/contextMaxIdleTtlMs", schemaPath: "#/definitions/CapabilityLimits/properties/contextMaxIdleTtlMs/maximum", keyword: "maximum", params: { comparison: "<=", limit: 9007199254740991 }, message: "must be <= 9007199254740991" }];
                                  return false;
                                } else {
                                  if (data16 < 0 || isNaN(data16)) {
                                    validate25.errors = [{ instancePath: instancePath + "/limits/contextMaxIdleTtlMs", schemaPath: "#/definitions/CapabilityLimits/properties/contextMaxIdleTtlMs/minimum", keyword: "minimum", params: { comparison: ">=", limit: 0 }, message: "must be >= 0" }];
                                    return false;
                                  }
                                }
                              }
                            }
                            var valid9 = _errs36 === errors;
                          } else {
                            var valid9 = true;
                          }
                          if (valid9) {
                            if (data13.envelopeTimeoutMs !== void 0) {
                              let data17 = data13.envelopeTimeoutMs;
                              const _errs38 = errors;
                              if (!(typeof data17 == "number" && (!(data17 % 1) && !isNaN(data17)) && isFinite(data17))) {
                                validate25.errors = [{ instancePath: instancePath + "/limits/envelopeTimeoutMs", schemaPath: "#/definitions/CapabilityLimits/properties/envelopeTimeoutMs/type", keyword: "type", params: { type: "integer" }, message: "must be integer" }];
                                return false;
                              }
                              if (errors === _errs38) {
                                if (typeof data17 == "number" && isFinite(data17)) {
                                  if (data17 > 9007199254740991 || isNaN(data17)) {
                                    validate25.errors = [{ instancePath: instancePath + "/limits/envelopeTimeoutMs", schemaPath: "#/definitions/CapabilityLimits/properties/envelopeTimeoutMs/maximum", keyword: "maximum", params: { comparison: "<=", limit: 9007199254740991 }, message: "must be <= 9007199254740991" }];
                                    return false;
                                  } else {
                                    if (data17 < 0 || isNaN(data17)) {
                                      validate25.errors = [{ instancePath: instancePath + "/limits/envelopeTimeoutMs", schemaPath: "#/definitions/CapabilityLimits/properties/envelopeTimeoutMs/minimum", keyword: "minimum", params: { comparison: ">=", limit: 0 }, message: "must be >= 0" }];
                                      return false;
                                    }
                                  }
                                }
                              }
                              var valid9 = _errs38 === errors;
                            } else {
                              var valid9 = true;
                            }
                            if (valid9) {
                              if (data13.maxAllowedOrigins !== void 0) {
                                let data18 = data13.maxAllowedOrigins;
                                const _errs40 = errors;
                                if (!(typeof data18 == "number" && (!(data18 % 1) && !isNaN(data18)) && isFinite(data18))) {
                                  validate25.errors = [{ instancePath: instancePath + "/limits/maxAllowedOrigins", schemaPath: "#/definitions/CapabilityLimits/properties/maxAllowedOrigins/type", keyword: "type", params: { type: "integer" }, message: "must be integer" }];
                                  return false;
                                }
                                if (errors === _errs40) {
                                  if (typeof data18 == "number" && isFinite(data18)) {
                                    if (data18 > 9007199254740991 || isNaN(data18)) {
                                      validate25.errors = [{ instancePath: instancePath + "/limits/maxAllowedOrigins", schemaPath: "#/definitions/CapabilityLimits/properties/maxAllowedOrigins/maximum", keyword: "maximum", params: { comparison: "<=", limit: 9007199254740991 }, message: "must be <= 9007199254740991" }];
                                      return false;
                                    } else {
                                      if (data18 < 0 || isNaN(data18)) {
                                        validate25.errors = [{ instancePath: instancePath + "/limits/maxAllowedOrigins", schemaPath: "#/definitions/CapabilityLimits/properties/maxAllowedOrigins/minimum", keyword: "minimum", params: { comparison: ">=", limit: 0 }, message: "must be >= 0" }];
                                        return false;
                                      }
                                    }
                                  }
                                }
                                var valid9 = _errs40 === errors;
                              } else {
                                var valid9 = true;
                              }
                              if (valid9) {
                                if (data13.maxConcurrent !== void 0) {
                                  let data19 = data13.maxConcurrent;
                                  const _errs42 = errors;
                                  if (!(typeof data19 == "number" && (!(data19 % 1) && !isNaN(data19)) && isFinite(data19))) {
                                    validate25.errors = [{ instancePath: instancePath + "/limits/maxConcurrent", schemaPath: "#/definitions/CapabilityLimits/properties/maxConcurrent/type", keyword: "type", params: { type: "integer" }, message: "must be integer" }];
                                    return false;
                                  }
                                  if (errors === _errs42) {
                                    if (typeof data19 == "number" && isFinite(data19)) {
                                      if (data19 > 9007199254740991 || isNaN(data19)) {
                                        validate25.errors = [{ instancePath: instancePath + "/limits/maxConcurrent", schemaPath: "#/definitions/CapabilityLimits/properties/maxConcurrent/maximum", keyword: "maximum", params: { comparison: "<=", limit: 9007199254740991 }, message: "must be <= 9007199254740991" }];
                                        return false;
                                      } else {
                                        if (data19 < 0 || isNaN(data19)) {
                                          validate25.errors = [{ instancePath: instancePath + "/limits/maxConcurrent", schemaPath: "#/definitions/CapabilityLimits/properties/maxConcurrent/minimum", keyword: "minimum", params: { comparison: ">=", limit: 0 }, message: "must be >= 0" }];
                                          return false;
                                        }
                                      }
                                    }
                                  }
                                  var valid9 = _errs42 === errors;
                                } else {
                                  var valid9 = true;
                                }
                                if (valid9) {
                                  if (data13.maxConcurrentPerPartition !== void 0) {
                                    let data20 = data13.maxConcurrentPerPartition;
                                    const _errs44 = errors;
                                    if (!(typeof data20 == "number" && (!(data20 % 1) && !isNaN(data20)) && isFinite(data20))) {
                                      validate25.errors = [{ instancePath: instancePath + "/limits/maxConcurrentPerPartition", schemaPath: "#/definitions/CapabilityLimits/properties/maxConcurrentPerPartition/type", keyword: "type", params: { type: "integer" }, message: "must be integer" }];
                                      return false;
                                    }
                                    if (errors === _errs44) {
                                      if (typeof data20 == "number" && isFinite(data20)) {
                                        if (data20 > 9007199254740991 || isNaN(data20)) {
                                          validate25.errors = [{ instancePath: instancePath + "/limits/maxConcurrentPerPartition", schemaPath: "#/definitions/CapabilityLimits/properties/maxConcurrentPerPartition/maximum", keyword: "maximum", params: { comparison: "<=", limit: 9007199254740991 }, message: "must be <= 9007199254740991" }];
                                          return false;
                                        } else {
                                          if (data20 < 0 || isNaN(data20)) {
                                            validate25.errors = [{ instancePath: instancePath + "/limits/maxConcurrentPerPartition", schemaPath: "#/definitions/CapabilityLimits/properties/maxConcurrentPerPartition/minimum", keyword: "minimum", params: { comparison: ">=", limit: 0 }, message: "must be >= 0" }];
                                            return false;
                                          }
                                        }
                                      }
                                    }
                                    var valid9 = _errs44 === errors;
                                  } else {
                                    var valid9 = true;
                                  }
                                  if (valid9) {
                                    if (data13.maxContexts !== void 0) {
                                      let data21 = data13.maxContexts;
                                      const _errs46 = errors;
                                      if (!(typeof data21 == "number" && (!(data21 % 1) && !isNaN(data21)) && isFinite(data21))) {
                                        validate25.errors = [{ instancePath: instancePath + "/limits/maxContexts", schemaPath: "#/definitions/CapabilityLimits/properties/maxContexts/type", keyword: "type", params: { type: "integer" }, message: "must be integer" }];
                                        return false;
                                      }
                                      if (errors === _errs46) {
                                        if (typeof data21 == "number" && isFinite(data21)) {
                                          if (data21 > 9007199254740991 || isNaN(data21)) {
                                            validate25.errors = [{ instancePath: instancePath + "/limits/maxContexts", schemaPath: "#/definitions/CapabilityLimits/properties/maxContexts/maximum", keyword: "maximum", params: { comparison: "<=", limit: 9007199254740991 }, message: "must be <= 9007199254740991" }];
                                            return false;
                                          } else {
                                            if (data21 < 0 || isNaN(data21)) {
                                              validate25.errors = [{ instancePath: instancePath + "/limits/maxContexts", schemaPath: "#/definitions/CapabilityLimits/properties/maxContexts/minimum", keyword: "minimum", params: { comparison: ">=", limit: 0 }, message: "must be >= 0" }];
                                              return false;
                                            }
                                          }
                                        }
                                      }
                                      var valid9 = _errs46 === errors;
                                    } else {
                                      var valid9 = true;
                                    }
                                    if (valid9) {
                                      if (data13.maxContextsPerPartition !== void 0) {
                                        let data22 = data13.maxContextsPerPartition;
                                        const _errs48 = errors;
                                        if (!(typeof data22 == "number" && (!(data22 % 1) && !isNaN(data22)) && isFinite(data22))) {
                                          validate25.errors = [{ instancePath: instancePath + "/limits/maxContextsPerPartition", schemaPath: "#/definitions/CapabilityLimits/properties/maxContextsPerPartition/type", keyword: "type", params: { type: "integer" }, message: "must be integer" }];
                                          return false;
                                        }
                                        if (errors === _errs48) {
                                          if (typeof data22 == "number" && isFinite(data22)) {
                                            if (data22 > 9007199254740991 || isNaN(data22)) {
                                              validate25.errors = [{ instancePath: instancePath + "/limits/maxContextsPerPartition", schemaPath: "#/definitions/CapabilityLimits/properties/maxContextsPerPartition/maximum", keyword: "maximum", params: { comparison: "<=", limit: 9007199254740991 }, message: "must be <= 9007199254740991" }];
                                              return false;
                                            } else {
                                              if (data22 < 0 || isNaN(data22)) {
                                                validate25.errors = [{ instancePath: instancePath + "/limits/maxContextsPerPartition", schemaPath: "#/definitions/CapabilityLimits/properties/maxContextsPerPartition/minimum", keyword: "minimum", params: { comparison: ">=", limit: 0 }, message: "must be >= 0" }];
                                                return false;
                                              }
                                            }
                                          }
                                        }
                                        var valid9 = _errs48 === errors;
                                      } else {
                                        var valid9 = true;
                                      }
                                      if (valid9) {
                                        if (data13.maxControlBytes !== void 0) {
                                          let data23 = data13.maxControlBytes;
                                          const _errs50 = errors;
                                          if (!(typeof data23 == "number" && (!(data23 % 1) && !isNaN(data23)) && isFinite(data23))) {
                                            validate25.errors = [{ instancePath: instancePath + "/limits/maxControlBytes", schemaPath: "#/definitions/CapabilityLimits/properties/maxControlBytes/type", keyword: "type", params: { type: "integer" }, message: "must be integer" }];
                                            return false;
                                          }
                                          if (errors === _errs50) {
                                            if (typeof data23 == "number" && isFinite(data23)) {
                                              if (data23 > 9007199254740991 || isNaN(data23)) {
                                                validate25.errors = [{ instancePath: instancePath + "/limits/maxControlBytes", schemaPath: "#/definitions/CapabilityLimits/properties/maxControlBytes/maximum", keyword: "maximum", params: { comparison: "<=", limit: 9007199254740991 }, message: "must be <= 9007199254740991" }];
                                                return false;
                                              } else {
                                                if (data23 < 0 || isNaN(data23)) {
                                                  validate25.errors = [{ instancePath: instancePath + "/limits/maxControlBytes", schemaPath: "#/definitions/CapabilityLimits/properties/maxControlBytes/minimum", keyword: "minimum", params: { comparison: ">=", limit: 0 }, message: "must be >= 0" }];
                                                  return false;
                                                }
                                              }
                                            }
                                          }
                                          var valid9 = _errs50 === errors;
                                        } else {
                                          var valid9 = true;
                                        }
                                        if (valid9) {
                                          if (data13.maxCookieBytes !== void 0) {
                                            let data24 = data13.maxCookieBytes;
                                            const _errs52 = errors;
                                            if (!(typeof data24 == "number" && (!(data24 % 1) && !isNaN(data24)) && isFinite(data24))) {
                                              validate25.errors = [{ instancePath: instancePath + "/limits/maxCookieBytes", schemaPath: "#/definitions/CapabilityLimits/properties/maxCookieBytes/type", keyword: "type", params: { type: "integer" }, message: "must be integer" }];
                                              return false;
                                            }
                                            if (errors === _errs52) {
                                              if (typeof data24 == "number" && isFinite(data24)) {
                                                if (data24 > 9007199254740991 || isNaN(data24)) {
                                                  validate25.errors = [{ instancePath: instancePath + "/limits/maxCookieBytes", schemaPath: "#/definitions/CapabilityLimits/properties/maxCookieBytes/maximum", keyword: "maximum", params: { comparison: "<=", limit: 9007199254740991 }, message: "must be <= 9007199254740991" }];
                                                  return false;
                                                } else {
                                                  if (data24 < 0 || isNaN(data24)) {
                                                    validate25.errors = [{ instancePath: instancePath + "/limits/maxCookieBytes", schemaPath: "#/definitions/CapabilityLimits/properties/maxCookieBytes/minimum", keyword: "minimum", params: { comparison: ">=", limit: 0 }, message: "must be >= 0" }];
                                                    return false;
                                                  }
                                                }
                                              }
                                            }
                                            var valid9 = _errs52 === errors;
                                          } else {
                                            var valid9 = true;
                                          }
                                          if (valid9) {
                                            if (data13.maxCookieSize !== void 0) {
                                              let data25 = data13.maxCookieSize;
                                              const _errs54 = errors;
                                              if (!(typeof data25 == "number" && (!(data25 % 1) && !isNaN(data25)) && isFinite(data25))) {
                                                validate25.errors = [{ instancePath: instancePath + "/limits/maxCookieSize", schemaPath: "#/definitions/CapabilityLimits/properties/maxCookieSize/type", keyword: "type", params: { type: "integer" }, message: "must be integer" }];
                                                return false;
                                              }
                                              if (errors === _errs54) {
                                                if (typeof data25 == "number" && isFinite(data25)) {
                                                  if (data25 > 9007199254740991 || isNaN(data25)) {
                                                    validate25.errors = [{ instancePath: instancePath + "/limits/maxCookieSize", schemaPath: "#/definitions/CapabilityLimits/properties/maxCookieSize/maximum", keyword: "maximum", params: { comparison: "<=", limit: 9007199254740991 }, message: "must be <= 9007199254740991" }];
                                                    return false;
                                                  } else {
                                                    if (data25 < 0 || isNaN(data25)) {
                                                      validate25.errors = [{ instancePath: instancePath + "/limits/maxCookieSize", schemaPath: "#/definitions/CapabilityLimits/properties/maxCookieSize/minimum", keyword: "minimum", params: { comparison: ">=", limit: 0 }, message: "must be >= 0" }];
                                                      return false;
                                                    }
                                                  }
                                                }
                                              }
                                              var valid9 = _errs54 === errors;
                                            } else {
                                              var valid9 = true;
                                            }
                                            if (valid9) {
                                              if (data13.maxCookies !== void 0) {
                                                let data26 = data13.maxCookies;
                                                const _errs56 = errors;
                                                if (!(typeof data26 == "number" && (!(data26 % 1) && !isNaN(data26)) && isFinite(data26))) {
                                                  validate25.errors = [{ instancePath: instancePath + "/limits/maxCookies", schemaPath: "#/definitions/CapabilityLimits/properties/maxCookies/type", keyword: "type", params: { type: "integer" }, message: "must be integer" }];
                                                  return false;
                                                }
                                                if (errors === _errs56) {
                                                  if (typeof data26 == "number" && isFinite(data26)) {
                                                    if (data26 > 9007199254740991 || isNaN(data26)) {
                                                      validate25.errors = [{ instancePath: instancePath + "/limits/maxCookies", schemaPath: "#/definitions/CapabilityLimits/properties/maxCookies/maximum", keyword: "maximum", params: { comparison: "<=", limit: 9007199254740991 }, message: "must be <= 9007199254740991" }];
                                                      return false;
                                                    } else {
                                                      if (data26 < 0 || isNaN(data26)) {
                                                        validate25.errors = [{ instancePath: instancePath + "/limits/maxCookies", schemaPath: "#/definitions/CapabilityLimits/properties/maxCookies/minimum", keyword: "minimum", params: { comparison: ">=", limit: 0 }, message: "must be >= 0" }];
                                                        return false;
                                                      }
                                                    }
                                                  }
                                                }
                                                var valid9 = _errs56 === errors;
                                              } else {
                                                var valid9 = true;
                                              }
                                              if (valid9) {
                                                if (data13.maxEnvelopes !== void 0) {
                                                  let data27 = data13.maxEnvelopes;
                                                  const _errs58 = errors;
                                                  if (!(typeof data27 == "number" && (!(data27 % 1) && !isNaN(data27)) && isFinite(data27))) {
                                                    validate25.errors = [{ instancePath: instancePath + "/limits/maxEnvelopes", schemaPath: "#/definitions/CapabilityLimits/properties/maxEnvelopes/type", keyword: "type", params: { type: "integer" }, message: "must be integer" }];
                                                    return false;
                                                  }
                                                  if (errors === _errs58) {
                                                    if (typeof data27 == "number" && isFinite(data27)) {
                                                      if (data27 > 9007199254740991 || isNaN(data27)) {
                                                        validate25.errors = [{ instancePath: instancePath + "/limits/maxEnvelopes", schemaPath: "#/definitions/CapabilityLimits/properties/maxEnvelopes/maximum", keyword: "maximum", params: { comparison: "<=", limit: 9007199254740991 }, message: "must be <= 9007199254740991" }];
                                                        return false;
                                                      } else {
                                                        if (data27 < 0 || isNaN(data27)) {
                                                          validate25.errors = [{ instancePath: instancePath + "/limits/maxEnvelopes", schemaPath: "#/definitions/CapabilityLimits/properties/maxEnvelopes/minimum", keyword: "minimum", params: { comparison: ">=", limit: 0 }, message: "must be >= 0" }];
                                                          return false;
                                                        }
                                                      }
                                                    }
                                                  }
                                                  var valid9 = _errs58 === errors;
                                                } else {
                                                  var valid9 = true;
                                                }
                                                if (valid9) {
                                                  if (data13.maxHeaderBytes !== void 0) {
                                                    let data28 = data13.maxHeaderBytes;
                                                    const _errs60 = errors;
                                                    if (!(typeof data28 == "number" && (!(data28 % 1) && !isNaN(data28)) && isFinite(data28))) {
                                                      validate25.errors = [{ instancePath: instancePath + "/limits/maxHeaderBytes", schemaPath: "#/definitions/CapabilityLimits/properties/maxHeaderBytes/type", keyword: "type", params: { type: "integer" }, message: "must be integer" }];
                                                      return false;
                                                    }
                                                    if (errors === _errs60) {
                                                      if (typeof data28 == "number" && isFinite(data28)) {
                                                        if (data28 > 9007199254740991 || isNaN(data28)) {
                                                          validate25.errors = [{ instancePath: instancePath + "/limits/maxHeaderBytes", schemaPath: "#/definitions/CapabilityLimits/properties/maxHeaderBytes/maximum", keyword: "maximum", params: { comparison: "<=", limit: 9007199254740991 }, message: "must be <= 9007199254740991" }];
                                                          return false;
                                                        } else {
                                                          if (data28 < 0 || isNaN(data28)) {
                                                            validate25.errors = [{ instancePath: instancePath + "/limits/maxHeaderBytes", schemaPath: "#/definitions/CapabilityLimits/properties/maxHeaderBytes/minimum", keyword: "minimum", params: { comparison: ">=", limit: 0 }, message: "must be >= 0" }];
                                                            return false;
                                                          }
                                                        }
                                                      }
                                                    }
                                                    var valid9 = _errs60 === errors;
                                                  } else {
                                                    var valid9 = true;
                                                  }
                                                  if (valid9) {
                                                    if (data13.maxHeaders !== void 0) {
                                                      let data29 = data13.maxHeaders;
                                                      const _errs62 = errors;
                                                      if (!(typeof data29 == "number" && (!(data29 % 1) && !isNaN(data29)) && isFinite(data29))) {
                                                        validate25.errors = [{ instancePath: instancePath + "/limits/maxHeaders", schemaPath: "#/definitions/CapabilityLimits/properties/maxHeaders/type", keyword: "type", params: { type: "integer" }, message: "must be integer" }];
                                                        return false;
                                                      }
                                                      if (errors === _errs62) {
                                                        if (typeof data29 == "number" && isFinite(data29)) {
                                                          if (data29 > 9007199254740991 || isNaN(data29)) {
                                                            validate25.errors = [{ instancePath: instancePath + "/limits/maxHeaders", schemaPath: "#/definitions/CapabilityLimits/properties/maxHeaders/maximum", keyword: "maximum", params: { comparison: "<=", limit: 9007199254740991 }, message: "must be <= 9007199254740991" }];
                                                            return false;
                                                          } else {
                                                            if (data29 < 0 || isNaN(data29)) {
                                                              validate25.errors = [{ instancePath: instancePath + "/limits/maxHeaders", schemaPath: "#/definitions/CapabilityLimits/properties/maxHeaders/minimum", keyword: "minimum", params: { comparison: ">=", limit: 0 }, message: "must be >= 0" }];
                                                              return false;
                                                            }
                                                          }
                                                        }
                                                      }
                                                      var valid9 = _errs62 === errors;
                                                    } else {
                                                      var valid9 = true;
                                                    }
                                                    if (valid9) {
                                                      if (data13.maxQueued !== void 0) {
                                                        let data30 = data13.maxQueued;
                                                        const _errs64 = errors;
                                                        if (!(typeof data30 == "number" && (!(data30 % 1) && !isNaN(data30)) && isFinite(data30))) {
                                                          validate25.errors = [{ instancePath: instancePath + "/limits/maxQueued", schemaPath: "#/definitions/CapabilityLimits/properties/maxQueued/type", keyword: "type", params: { type: "integer" }, message: "must be integer" }];
                                                          return false;
                                                        }
                                                        if (errors === _errs64) {
                                                          if (typeof data30 == "number" && isFinite(data30)) {
                                                            if (data30 > 9007199254740991 || isNaN(data30)) {
                                                              validate25.errors = [{ instancePath: instancePath + "/limits/maxQueued", schemaPath: "#/definitions/CapabilityLimits/properties/maxQueued/maximum", keyword: "maximum", params: { comparison: "<=", limit: 9007199254740991 }, message: "must be <= 9007199254740991" }];
                                                              return false;
                                                            } else {
                                                              if (data30 < 0 || isNaN(data30)) {
                                                                validate25.errors = [{ instancePath: instancePath + "/limits/maxQueued", schemaPath: "#/definitions/CapabilityLimits/properties/maxQueued/minimum", keyword: "minimum", params: { comparison: ">=", limit: 0 }, message: "must be >= 0" }];
                                                                return false;
                                                              }
                                                            }
                                                          }
                                                        }
                                                        var valid9 = _errs64 === errors;
                                                      } else {
                                                        var valid9 = true;
                                                      }
                                                      if (valid9) {
                                                        if (data13.maxQueuedPerPartition !== void 0) {
                                                          let data31 = data13.maxQueuedPerPartition;
                                                          const _errs66 = errors;
                                                          if (!(typeof data31 == "number" && (!(data31 % 1) && !isNaN(data31)) && isFinite(data31))) {
                                                            validate25.errors = [{ instancePath: instancePath + "/limits/maxQueuedPerPartition", schemaPath: "#/definitions/CapabilityLimits/properties/maxQueuedPerPartition/type", keyword: "type", params: { type: "integer" }, message: "must be integer" }];
                                                            return false;
                                                          }
                                                          if (errors === _errs66) {
                                                            if (typeof data31 == "number" && isFinite(data31)) {
                                                              if (data31 > 9007199254740991 || isNaN(data31)) {
                                                                validate25.errors = [{ instancePath: instancePath + "/limits/maxQueuedPerPartition", schemaPath: "#/definitions/CapabilityLimits/properties/maxQueuedPerPartition/maximum", keyword: "maximum", params: { comparison: "<=", limit: 9007199254740991 }, message: "must be <= 9007199254740991" }];
                                                                return false;
                                                              } else {
                                                                if (data31 < 0 || isNaN(data31)) {
                                                                  validate25.errors = [{ instancePath: instancePath + "/limits/maxQueuedPerPartition", schemaPath: "#/definitions/CapabilityLimits/properties/maxQueuedPerPartition/minimum", keyword: "minimum", params: { comparison: ">=", limit: 0 }, message: "must be >= 0" }];
                                                                  return false;
                                                                }
                                                              }
                                                            }
                                                          }
                                                          var valid9 = _errs66 === errors;
                                                        } else {
                                                          var valid9 = true;
                                                        }
                                                        if (valid9) {
                                                          if (data13.maxRequestBytes !== void 0) {
                                                            let data32 = data13.maxRequestBytes;
                                                            const _errs68 = errors;
                                                            if (!(typeof data32 == "number" && (!(data32 % 1) && !isNaN(data32)) && isFinite(data32))) {
                                                              validate25.errors = [{ instancePath: instancePath + "/limits/maxRequestBytes", schemaPath: "#/definitions/CapabilityLimits/properties/maxRequestBytes/type", keyword: "type", params: { type: "integer" }, message: "must be integer" }];
                                                              return false;
                                                            }
                                                            if (errors === _errs68) {
                                                              if (typeof data32 == "number" && isFinite(data32)) {
                                                                if (data32 > 9007199254740991 || isNaN(data32)) {
                                                                  validate25.errors = [{ instancePath: instancePath + "/limits/maxRequestBytes", schemaPath: "#/definitions/CapabilityLimits/properties/maxRequestBytes/maximum", keyword: "maximum", params: { comparison: "<=", limit: 9007199254740991 }, message: "must be <= 9007199254740991" }];
                                                                  return false;
                                                                } else {
                                                                  if (data32 < 0 || isNaN(data32)) {
                                                                    validate25.errors = [{ instancePath: instancePath + "/limits/maxRequestBytes", schemaPath: "#/definitions/CapabilityLimits/properties/maxRequestBytes/minimum", keyword: "minimum", params: { comparison: ">=", limit: 0 }, message: "must be >= 0" }];
                                                                    return false;
                                                                  }
                                                                }
                                                              }
                                                            }
                                                            var valid9 = _errs68 === errors;
                                                          } else {
                                                            var valid9 = true;
                                                          }
                                                          if (valid9) {
                                                            if (data13.maxResponseBytes !== void 0) {
                                                              let data33 = data13.maxResponseBytes;
                                                              const _errs70 = errors;
                                                              if (!(typeof data33 == "number" && (!(data33 % 1) && !isNaN(data33)) && isFinite(data33))) {
                                                                validate25.errors = [{ instancePath: instancePath + "/limits/maxResponseBytes", schemaPath: "#/definitions/CapabilityLimits/properties/maxResponseBytes/type", keyword: "type", params: { type: "integer" }, message: "must be integer" }];
                                                                return false;
                                                              }
                                                              if (errors === _errs70) {
                                                                if (typeof data33 == "number" && isFinite(data33)) {
                                                                  if (data33 > 9007199254740991 || isNaN(data33)) {
                                                                    validate25.errors = [{ instancePath: instancePath + "/limits/maxResponseBytes", schemaPath: "#/definitions/CapabilityLimits/properties/maxResponseBytes/maximum", keyword: "maximum", params: { comparison: "<=", limit: 9007199254740991 }, message: "must be <= 9007199254740991" }];
                                                                    return false;
                                                                  } else {
                                                                    if (data33 < 0 || isNaN(data33)) {
                                                                      validate25.errors = [{ instancePath: instancePath + "/limits/maxResponseBytes", schemaPath: "#/definitions/CapabilityLimits/properties/maxResponseBytes/minimum", keyword: "minimum", params: { comparison: ">=", limit: 0 }, message: "must be >= 0" }];
                                                                      return false;
                                                                    }
                                                                  }
                                                                }
                                                              }
                                                              var valid9 = _errs70 === errors;
                                                            } else {
                                                              var valid9 = true;
                                                            }
                                                            if (valid9) {
                                                              if (data13.maxTimeoutMs !== void 0) {
                                                                let data34 = data13.maxTimeoutMs;
                                                                const _errs72 = errors;
                                                                if (!(typeof data34 == "number" && (!(data34 % 1) && !isNaN(data34)) && isFinite(data34))) {
                                                                  validate25.errors = [{ instancePath: instancePath + "/limits/maxTimeoutMs", schemaPath: "#/definitions/CapabilityLimits/properties/maxTimeoutMs/type", keyword: "type", params: { type: "integer" }, message: "must be integer" }];
                                                                  return false;
                                                                }
                                                                if (errors === _errs72) {
                                                                  if (typeof data34 == "number" && isFinite(data34)) {
                                                                    if (data34 > 9007199254740991 || isNaN(data34)) {
                                                                      validate25.errors = [{ instancePath: instancePath + "/limits/maxTimeoutMs", schemaPath: "#/definitions/CapabilityLimits/properties/maxTimeoutMs/maximum", keyword: "maximum", params: { comparison: "<=", limit: 9007199254740991 }, message: "must be <= 9007199254740991" }];
                                                                      return false;
                                                                    } else {
                                                                      if (data34 < 0 || isNaN(data34)) {
                                                                        validate25.errors = [{ instancePath: instancePath + "/limits/maxTimeoutMs", schemaPath: "#/definitions/CapabilityLimits/properties/maxTimeoutMs/minimum", keyword: "minimum", params: { comparison: ">=", limit: 0 }, message: "must be >= 0" }];
                                                                        return false;
                                                                      }
                                                                    }
                                                                  }
                                                                }
                                                                var valid9 = _errs72 === errors;
                                                              } else {
                                                                var valid9 = true;
                                                              }
                                                              if (valid9) {
                                                                if (data13.registryCapacity !== void 0) {
                                                                  let data35 = data13.registryCapacity;
                                                                  const _errs74 = errors;
                                                                  if (!(typeof data35 == "number" && (!(data35 % 1) && !isNaN(data35)) && isFinite(data35))) {
                                                                    validate25.errors = [{ instancePath: instancePath + "/limits/registryCapacity", schemaPath: "#/definitions/CapabilityLimits/properties/registryCapacity/type", keyword: "type", params: { type: "integer" }, message: "must be integer" }];
                                                                    return false;
                                                                  }
                                                                  if (errors === _errs74) {
                                                                    if (typeof data35 == "number" && isFinite(data35)) {
                                                                      if (data35 > 9007199254740991 || isNaN(data35)) {
                                                                        validate25.errors = [{ instancePath: instancePath + "/limits/registryCapacity", schemaPath: "#/definitions/CapabilityLimits/properties/registryCapacity/maximum", keyword: "maximum", params: { comparison: "<=", limit: 9007199254740991 }, message: "must be <= 9007199254740991" }];
                                                                        return false;
                                                                      } else {
                                                                        if (data35 < 0 || isNaN(data35)) {
                                                                          validate25.errors = [{ instancePath: instancePath + "/limits/registryCapacity", schemaPath: "#/definitions/CapabilityLimits/properties/registryCapacity/minimum", keyword: "minimum", params: { comparison: ">=", limit: 0 }, message: "must be >= 0" }];
                                                                          return false;
                                                                        }
                                                                      }
                                                                    }
                                                                  }
                                                                  var valid9 = _errs74 === errors;
                                                                } else {
                                                                  var valid9 = true;
                                                                }
                                                                if (valid9) {
                                                                  if (data13.registryTtlMs !== void 0) {
                                                                    let data36 = data13.registryTtlMs;
                                                                    const _errs76 = errors;
                                                                    if (!(typeof data36 == "number" && (!(data36 % 1) && !isNaN(data36)) && isFinite(data36))) {
                                                                      validate25.errors = [{ instancePath: instancePath + "/limits/registryTtlMs", schemaPath: "#/definitions/CapabilityLimits/properties/registryTtlMs/type", keyword: "type", params: { type: "integer" }, message: "must be integer" }];
                                                                      return false;
                                                                    }
                                                                    if (errors === _errs76) {
                                                                      if (typeof data36 == "number" && isFinite(data36)) {
                                                                        if (data36 > 9007199254740991 || isNaN(data36)) {
                                                                          validate25.errors = [{ instancePath: instancePath + "/limits/registryTtlMs", schemaPath: "#/definitions/CapabilityLimits/properties/registryTtlMs/maximum", keyword: "maximum", params: { comparison: "<=", limit: 9007199254740991 }, message: "must be <= 9007199254740991" }];
                                                                          return false;
                                                                        } else {
                                                                          if (data36 < 0 || isNaN(data36)) {
                                                                            validate25.errors = [{ instancePath: instancePath + "/limits/registryTtlMs", schemaPath: "#/definitions/CapabilityLimits/properties/registryTtlMs/minimum", keyword: "minimum", params: { comparison: ">=", limit: 0 }, message: "must be >= 0" }];
                                                                            return false;
                                                                          }
                                                                        }
                                                                      }
                                                                    }
                                                                    var valid9 = _errs76 === errors;
                                                                  } else {
                                                                    var valid9 = true;
                                                                  }
                                                                }
                                                              }
                                                            }
                                                          }
                                                        }
                                                      }
                                                    }
                                                  }
                                                }
                                              }
                                            }
                                          }
                                        }
                                      }
                                    }
                                  }
                                }
                              }
                            }
                          }
                        }
                      }
                    }
                  } else {
                    validate25.errors = [{ instancePath: instancePath + "/limits", schemaPath: "#/definitions/CapabilityLimits/type", keyword: "type", params: { type: "object" }, message: "must be object" }];
                    return false;
                  }
                }
                var valid0 = _errs29 === errors;
              } else {
                var valid0 = true;
              }
              if (valid0) {
                if (data.modes !== void 0) {
                  let data37 = data.modes;
                  const _errs78 = errors;
                  const _errs79 = errors;
                  if (errors === _errs79) {
                    if (data37 && typeof data37 == "object" && !Array.isArray(data37)) {
                      let missing4;
                      if (data37.egress === void 0 && (missing4 = "egress") || data37.cookies === void 0 && (missing4 = "cookies") || data37.stream === void 0 && (missing4 = "stream") || data37.cancel === void 0 && (missing4 = "cancel")) {
                        validate25.errors = [{ instancePath: instancePath + "/modes", schemaPath: "#/definitions/CapabilityModes/required", keyword: "required", params: { missingProperty: missing4 }, message: "must have required property '" + missing4 + "'" }];
                        return false;
                      } else {
                        if (data37.cancel !== void 0) {
                          let data38 = data37.cancel;
                          const _errs81 = errors;
                          if (errors === _errs81) {
                            if (Array.isArray(data38)) {
                              var valid12 = true;
                              const len3 = data38.length;
                              for (let i2 = 0; i2 < len3; i2++) {
                                const _errs83 = errors;
                                if (typeof data38[i2] !== "string") {
                                  validate25.errors = [{ instancePath: instancePath + "/modes/cancel/" + i2, schemaPath: "#/definitions/CapabilityModes/properties/cancel/items/type", keyword: "type", params: { type: "string" }, message: "must be string" }];
                                  return false;
                                }
                                var valid12 = _errs83 === errors;
                                if (!valid12) {
                                  break;
                                }
                              }
                            } else {
                              validate25.errors = [{ instancePath: instancePath + "/modes/cancel", schemaPath: "#/definitions/CapabilityModes/properties/cancel/type", keyword: "type", params: { type: "array" }, message: "must be array" }];
                              return false;
                            }
                          }
                          var valid11 = _errs81 === errors;
                        } else {
                          var valid11 = true;
                        }
                        if (valid11) {
                          if (data37.cookies !== void 0) {
                            let data40 = data37.cookies;
                            const _errs85 = errors;
                            if (errors === _errs85) {
                              if (Array.isArray(data40)) {
                                var valid13 = true;
                                const len4 = data40.length;
                                for (let i3 = 0; i3 < len4; i3++) {
                                  const _errs87 = errors;
                                  if (typeof data40[i3] !== "string") {
                                    validate25.errors = [{ instancePath: instancePath + "/modes/cookies/" + i3, schemaPath: "#/definitions/CapabilityModes/properties/cookies/items/type", keyword: "type", params: { type: "string" }, message: "must be string" }];
                                    return false;
                                  }
                                  var valid13 = _errs87 === errors;
                                  if (!valid13) {
                                    break;
                                  }
                                }
                              } else {
                                validate25.errors = [{ instancePath: instancePath + "/modes/cookies", schemaPath: "#/definitions/CapabilityModes/properties/cookies/type", keyword: "type", params: { type: "array" }, message: "must be array" }];
                                return false;
                              }
                            }
                            var valid11 = _errs85 === errors;
                          } else {
                            var valid11 = true;
                          }
                          if (valid11) {
                            if (data37.egress !== void 0) {
                              let data42 = data37.egress;
                              const _errs89 = errors;
                              if (errors === _errs89) {
                                if (Array.isArray(data42)) {
                                  var valid14 = true;
                                  const len5 = data42.length;
                                  for (let i4 = 0; i4 < len5; i4++) {
                                    const _errs91 = errors;
                                    if (typeof data42[i4] !== "string") {
                                      validate25.errors = [{ instancePath: instancePath + "/modes/egress/" + i4, schemaPath: "#/definitions/CapabilityModes/properties/egress/items/type", keyword: "type", params: { type: "string" }, message: "must be string" }];
                                      return false;
                                    }
                                    var valid14 = _errs91 === errors;
                                    if (!valid14) {
                                      break;
                                    }
                                  }
                                } else {
                                  validate25.errors = [{ instancePath: instancePath + "/modes/egress", schemaPath: "#/definitions/CapabilityModes/properties/egress/type", keyword: "type", params: { type: "array" }, message: "must be array" }];
                                  return false;
                                }
                              }
                              var valid11 = _errs89 === errors;
                            } else {
                              var valid11 = true;
                            }
                            if (valid11) {
                              if (data37.stream !== void 0) {
                                let data44 = data37.stream;
                                const _errs93 = errors;
                                if (errors === _errs93) {
                                  if (Array.isArray(data44)) {
                                    var valid15 = true;
                                    const len6 = data44.length;
                                    for (let i5 = 0; i5 < len6; i5++) {
                                      const _errs95 = errors;
                                      if (typeof data44[i5] !== "string") {
                                        validate25.errors = [{ instancePath: instancePath + "/modes/stream/" + i5, schemaPath: "#/definitions/CapabilityModes/properties/stream/items/type", keyword: "type", params: { type: "string" }, message: "must be string" }];
                                        return false;
                                      }
                                      var valid15 = _errs95 === errors;
                                      if (!valid15) {
                                        break;
                                      }
                                    }
                                  } else {
                                    validate25.errors = [{ instancePath: instancePath + "/modes/stream", schemaPath: "#/definitions/CapabilityModes/properties/stream/type", keyword: "type", params: { type: "array" }, message: "must be array" }];
                                    return false;
                                  }
                                }
                                var valid11 = _errs93 === errors;
                              } else {
                                var valid11 = true;
                              }
                            }
                          }
                        }
                      }
                    } else {
                      validate25.errors = [{ instancePath: instancePath + "/modes", schemaPath: "#/definitions/CapabilityModes/type", keyword: "type", params: { type: "object" }, message: "must be object" }];
                      return false;
                    }
                  }
                  var valid0 = _errs78 === errors;
                } else {
                  var valid0 = true;
                }
                if (valid0) {
                  if (data.profiles !== void 0) {
                    let data46 = data.profiles;
                    const _errs97 = errors;
                    if (errors === _errs97) {
                      if (Array.isArray(data46)) {
                        var valid16 = true;
                        const len7 = data46.length;
                        for (let i6 = 0; i6 < len7; i6++) {
                          const _errs99 = errors;
                          if (typeof data46[i6] !== "string") {
                            validate25.errors = [{ instancePath: instancePath + "/profiles/" + i6, schemaPath: "#/properties/profiles/items/type", keyword: "type", params: { type: "string" }, message: "must be string" }];
                            return false;
                          }
                          var valid16 = _errs99 === errors;
                          if (!valid16) {
                            break;
                          }
                        }
                      } else {
                        validate25.errors = [{ instancePath: instancePath + "/profiles", schemaPath: "#/properties/profiles/type", keyword: "type", params: { type: "array" }, message: "must be array" }];
                        return false;
                      }
                    }
                    var valid0 = _errs97 === errors;
                  } else {
                    var valid0 = true;
                  }
                  if (valid0) {
                    if (data.service !== void 0) {
                      let data48 = data.service;
                      const _errs101 = errors;
                      if (typeof data48 !== "string") {
                        validate25.errors = [{ instancePath: instancePath + "/service", schemaPath: "#/definitions/ServiceName/type", keyword: "type", params: { type: "string" }, message: "must be string" }];
                        return false;
                      }
                      if (!(data48 === "ja3proxy")) {
                        validate25.errors = [{ instancePath: instancePath + "/service", schemaPath: "#/definitions/ServiceName/enum", keyword: "enum", params: { allowedValues: schema40.enum }, message: "must be equal to one of the allowed values" }];
                        return false;
                      }
                      var valid0 = _errs101 === errors;
                    } else {
                      var valid0 = true;
                    }
                  }
                }
              }
            }
          }
        }
      }
    } else {
      validate25.errors = [{ instancePath, schemaPath: "#/type", keyword: "type", params: { type: "object" }, message: "must be object" }];
      return false;
    }
  }
  validate25.errors = vErrors;
  return errors === 0;
}
var createContext = validate26;
var schema41 = { "$id": "https://ja3proxy.invalid/contracts/createContext.schema.json", "$schema": "http://json-schema.org/draft-07/schema#", "additionalProperties": false, "definitions": { "BrowserIdentity": { "additionalProperties": false, "properties": { "emulateHeaders": { "type": "boolean" }, "tlsProfile": { "type": "string" }, "userAgent": { "type": ["string", "null"] } }, "required": ["tlsProfile", "emulateHeaders"], "type": "object" }, "ConnectionSpec": { "additionalProperties": false, "properties": { "egress": { "$ref": "#/definitions/Egress" }, "identity": { "$ref": "#/definitions/BrowserIdentity" } }, "required": ["egress", "identity"], "type": "object" }, "CookieMode": { "enum": ["external", "managed"], "type": "string" }, "Egress": { "oneOf": [{ "additionalProperties": false, "properties": { "mode": { "const": "direct", "type": "string" } }, "required": ["mode"], "type": "object" }, { "additionalProperties": false, "properties": { "mode": { "const": "proxy", "type": "string" }, "url": { "type": "string" } }, "required": ["mode", "url"], "type": "object" }] } }, "properties": { "allowedOrigins": { "items": { "type": "string" }, "type": "array" }, "connection": { "$ref": "#/definitions/ConnectionSpec" }, "cookieMode": { "$ref": "#/definitions/CookieMode" }, "partition": { "type": "string" }, "ttlMs": { "format": "uint64", "minimum": 0, "type": ["integer", "null"], "maximum": 9007199254740991 } }, "required": ["partition", "connection", "cookieMode", "allowedOrigins"], "title": "CreateContext", "type": "object" };
var schema45 = { "enum": ["external", "managed"], "type": "string" };
var schema44 = { "additionalProperties": false, "properties": { "emulateHeaders": { "type": "boolean" }, "tlsProfile": { "type": "string" }, "userAgent": { "type": ["string", "null"] } }, "required": ["tlsProfile", "emulateHeaders"], "type": "object" };
function validate27(data, { instancePath = "", parentData, parentDataProperty, rootData = data } = {}) {
  let vErrors = null;
  let errors = 0;
  if (errors === 0) {
    if (data && typeof data == "object" && !Array.isArray(data)) {
      let missing0;
      if (data.egress === void 0 && (missing0 = "egress") || data.identity === void 0 && (missing0 = "identity")) {
        validate27.errors = [{ instancePath, schemaPath: "#/required", keyword: "required", params: { missingProperty: missing0 }, message: "must have required property '" + missing0 + "'" }];
        return false;
      } else {
        const _errs1 = errors;
        for (const key0 in data) {
          if (!(key0 === "egress" || key0 === "identity")) {
            validate27.errors = [{ instancePath, schemaPath: "#/additionalProperties", keyword: "additionalProperties", params: { additionalProperty: key0 }, message: "must NOT have additional properties" }];
            return false;
            break;
          }
        }
        if (_errs1 === errors) {
          if (data.egress !== void 0) {
            let data0 = data.egress;
            const _errs2 = errors;
            const _errs4 = errors;
            let valid2 = false;
            let passing0 = null;
            const _errs5 = errors;
            if (errors === _errs5) {
              if (data0 && typeof data0 == "object" && !Array.isArray(data0)) {
                let missing1;
                if (data0.mode === void 0 && (missing1 = "mode")) {
                  const err0 = { instancePath: instancePath + "/egress", schemaPath: "#/definitions/Egress/oneOf/0/required", keyword: "required", params: { missingProperty: missing1 }, message: "must have required property '" + missing1 + "'" };
                  if (vErrors === null) {
                    vErrors = [err0];
                  } else {
                    vErrors.push(err0);
                  }
                  errors++;
                } else {
                  const _errs7 = errors;
                  for (const key1 in data0) {
                    if (!(key1 === "mode")) {
                      const err1 = { instancePath: instancePath + "/egress", schemaPath: "#/definitions/Egress/oneOf/0/additionalProperties", keyword: "additionalProperties", params: { additionalProperty: key1 }, message: "must NOT have additional properties" };
                      if (vErrors === null) {
                        vErrors = [err1];
                      } else {
                        vErrors.push(err1);
                      }
                      errors++;
                      break;
                    }
                  }
                  if (_errs7 === errors) {
                    if (data0.mode !== void 0) {
                      let data1 = data0.mode;
                      if (typeof data1 !== "string") {
                        const err2 = { instancePath: instancePath + "/egress/mode", schemaPath: "#/definitions/Egress/oneOf/0/properties/mode/type", keyword: "type", params: { type: "string" }, message: "must be string" };
                        if (vErrors === null) {
                          vErrors = [err2];
                        } else {
                          vErrors.push(err2);
                        }
                        errors++;
                      }
                      if ("direct" !== data1) {
                        const err3 = { instancePath: instancePath + "/egress/mode", schemaPath: "#/definitions/Egress/oneOf/0/properties/mode/const", keyword: "const", params: { allowedValue: "direct" }, message: "must be equal to constant" };
                        if (vErrors === null) {
                          vErrors = [err3];
                        } else {
                          vErrors.push(err3);
                        }
                        errors++;
                      }
                    }
                  }
                }
              } else {
                const err4 = { instancePath: instancePath + "/egress", schemaPath: "#/definitions/Egress/oneOf/0/type", keyword: "type", params: { type: "object" }, message: "must be object" };
                if (vErrors === null) {
                  vErrors = [err4];
                } else {
                  vErrors.push(err4);
                }
                errors++;
              }
            }
            var _valid0 = _errs5 === errors;
            if (_valid0) {
              valid2 = true;
              passing0 = 0;
            }
            const _errs10 = errors;
            if (errors === _errs10) {
              if (data0 && typeof data0 == "object" && !Array.isArray(data0)) {
                let missing2;
                if (data0.mode === void 0 && (missing2 = "mode") || data0.url === void 0 && (missing2 = "url")) {
                  const err5 = { instancePath: instancePath + "/egress", schemaPath: "#/definitions/Egress/oneOf/1/required", keyword: "required", params: { missingProperty: missing2 }, message: "must have required property '" + missing2 + "'" };
                  if (vErrors === null) {
                    vErrors = [err5];
                  } else {
                    vErrors.push(err5);
                  }
                  errors++;
                } else {
                  const _errs12 = errors;
                  for (const key2 in data0) {
                    if (!(key2 === "mode" || key2 === "url")) {
                      const err6 = { instancePath: instancePath + "/egress", schemaPath: "#/definitions/Egress/oneOf/1/additionalProperties", keyword: "additionalProperties", params: { additionalProperty: key2 }, message: "must NOT have additional properties" };
                      if (vErrors === null) {
                        vErrors = [err6];
                      } else {
                        vErrors.push(err6);
                      }
                      errors++;
                      break;
                    }
                  }
                  if (_errs12 === errors) {
                    if (data0.mode !== void 0) {
                      let data2 = data0.mode;
                      const _errs13 = errors;
                      if (typeof data2 !== "string") {
                        const err7 = { instancePath: instancePath + "/egress/mode", schemaPath: "#/definitions/Egress/oneOf/1/properties/mode/type", keyword: "type", params: { type: "string" }, message: "must be string" };
                        if (vErrors === null) {
                          vErrors = [err7];
                        } else {
                          vErrors.push(err7);
                        }
                        errors++;
                      }
                      if ("proxy" !== data2) {
                        const err8 = { instancePath: instancePath + "/egress/mode", schemaPath: "#/definitions/Egress/oneOf/1/properties/mode/const", keyword: "const", params: { allowedValue: "proxy" }, message: "must be equal to constant" };
                        if (vErrors === null) {
                          vErrors = [err8];
                        } else {
                          vErrors.push(err8);
                        }
                        errors++;
                      }
                      var valid4 = _errs13 === errors;
                    } else {
                      var valid4 = true;
                    }
                    if (valid4) {
                      if (data0.url !== void 0) {
                        const _errs15 = errors;
                        if (typeof data0.url !== "string") {
                          const err9 = { instancePath: instancePath + "/egress/url", schemaPath: "#/definitions/Egress/oneOf/1/properties/url/type", keyword: "type", params: { type: "string" }, message: "must be string" };
                          if (vErrors === null) {
                            vErrors = [err9];
                          } else {
                            vErrors.push(err9);
                          }
                          errors++;
                        }
                        var valid4 = _errs15 === errors;
                      } else {
                        var valid4 = true;
                      }
                    }
                  }
                }
              } else {
                const err10 = { instancePath: instancePath + "/egress", schemaPath: "#/definitions/Egress/oneOf/1/type", keyword: "type", params: { type: "object" }, message: "must be object" };
                if (vErrors === null) {
                  vErrors = [err10];
                } else {
                  vErrors.push(err10);
                }
                errors++;
              }
            }
            var _valid0 = _errs10 === errors;
            if (_valid0 && valid2) {
              valid2 = false;
              passing0 = [passing0, 1];
            } else {
              if (_valid0) {
                valid2 = true;
                passing0 = 1;
              }
            }
            if (!valid2) {
              const err11 = { instancePath: instancePath + "/egress", schemaPath: "#/definitions/Egress/oneOf", keyword: "oneOf", params: { passingSchemas: passing0 }, message: "must match exactly one schema in oneOf" };
              if (vErrors === null) {
                vErrors = [err11];
              } else {
                vErrors.push(err11);
              }
              errors++;
              validate27.errors = vErrors;
              return false;
            } else {
              errors = _errs4;
              if (vErrors !== null) {
                if (_errs4) {
                  vErrors.length = _errs4;
                } else {
                  vErrors = null;
                }
              }
            }
            var valid0 = _errs2 === errors;
          } else {
            var valid0 = true;
          }
          if (valid0) {
            if (data.identity !== void 0) {
              let data4 = data.identity;
              const _errs17 = errors;
              const _errs18 = errors;
              if (errors === _errs18) {
                if (data4 && typeof data4 == "object" && !Array.isArray(data4)) {
                  let missing3;
                  if (data4.tlsProfile === void 0 && (missing3 = "tlsProfile") || data4.emulateHeaders === void 0 && (missing3 = "emulateHeaders")) {
                    validate27.errors = [{ instancePath: instancePath + "/identity", schemaPath: "#/definitions/BrowserIdentity/required", keyword: "required", params: { missingProperty: missing3 }, message: "must have required property '" + missing3 + "'" }];
                    return false;
                  } else {
                    const _errs20 = errors;
                    for (const key3 in data4) {
                      if (!(key3 === "emulateHeaders" || key3 === "tlsProfile" || key3 === "userAgent")) {
                        validate27.errors = [{ instancePath: instancePath + "/identity", schemaPath: "#/definitions/BrowserIdentity/additionalProperties", keyword: "additionalProperties", params: { additionalProperty: key3 }, message: "must NOT have additional properties" }];
                        return false;
                        break;
                      }
                    }
                    if (_errs20 === errors) {
                      if (data4.emulateHeaders !== void 0) {
                        const _errs21 = errors;
                        if (typeof data4.emulateHeaders !== "boolean") {
                          validate27.errors = [{ instancePath: instancePath + "/identity/emulateHeaders", schemaPath: "#/definitions/BrowserIdentity/properties/emulateHeaders/type", keyword: "type", params: { type: "boolean" }, message: "must be boolean" }];
                          return false;
                        }
                        var valid6 = _errs21 === errors;
                      } else {
                        var valid6 = true;
                      }
                      if (valid6) {
                        if (data4.tlsProfile !== void 0) {
                          const _errs23 = errors;
                          if (typeof data4.tlsProfile !== "string") {
                            validate27.errors = [{ instancePath: instancePath + "/identity/tlsProfile", schemaPath: "#/definitions/BrowserIdentity/properties/tlsProfile/type", keyword: "type", params: { type: "string" }, message: "must be string" }];
                            return false;
                          }
                          var valid6 = _errs23 === errors;
                        } else {
                          var valid6 = true;
                        }
                        if (valid6) {
                          if (data4.userAgent !== void 0) {
                            let data7 = data4.userAgent;
                            const _errs25 = errors;
                            if (typeof data7 !== "string" && data7 !== null) {
                              validate27.errors = [{ instancePath: instancePath + "/identity/userAgent", schemaPath: "#/definitions/BrowserIdentity/properties/userAgent/type", keyword: "type", params: { type: schema44.properties.userAgent.type }, message: "must be string,null" }];
                              return false;
                            }
                            var valid6 = _errs25 === errors;
                          } else {
                            var valid6 = true;
                          }
                        }
                      }
                    }
                  }
                } else {
                  validate27.errors = [{ instancePath: instancePath + "/identity", schemaPath: "#/definitions/BrowserIdentity/type", keyword: "type", params: { type: "object" }, message: "must be object" }];
                  return false;
                }
              }
              var valid0 = _errs17 === errors;
            } else {
              var valid0 = true;
            }
          }
        }
      }
    } else {
      validate27.errors = [{ instancePath, schemaPath: "#/type", keyword: "type", params: { type: "object" }, message: "must be object" }];
      return false;
    }
  }
  validate27.errors = vErrors;
  return errors === 0;
}
function validate26(data, { instancePath = "", parentData, parentDataProperty, rootData = data } = {}) {
  ;
  let vErrors = null;
  let errors = 0;
  if (errors === 0) {
    if (data && typeof data == "object" && !Array.isArray(data)) {
      let missing0;
      if (data.partition === void 0 && (missing0 = "partition") || data.connection === void 0 && (missing0 = "connection") || data.cookieMode === void 0 && (missing0 = "cookieMode") || data.allowedOrigins === void 0 && (missing0 = "allowedOrigins")) {
        validate26.errors = [{ instancePath, schemaPath: "#/required", keyword: "required", params: { missingProperty: missing0 }, message: "must have required property '" + missing0 + "'" }];
        return false;
      } else {
        const _errs1 = errors;
        for (const key0 in data) {
          if (!(key0 === "allowedOrigins" || key0 === "connection" || key0 === "cookieMode" || key0 === "partition" || key0 === "ttlMs")) {
            validate26.errors = [{ instancePath, schemaPath: "#/additionalProperties", keyword: "additionalProperties", params: { additionalProperty: key0 }, message: "must NOT have additional properties" }];
            return false;
            break;
          }
        }
        if (_errs1 === errors) {
          if (data.allowedOrigins !== void 0) {
            let data0 = data.allowedOrigins;
            const _errs2 = errors;
            if (errors === _errs2) {
              if (Array.isArray(data0)) {
                var valid1 = true;
                const len0 = data0.length;
                for (let i0 = 0; i0 < len0; i0++) {
                  const _errs4 = errors;
                  if (typeof data0[i0] !== "string") {
                    validate26.errors = [{ instancePath: instancePath + "/allowedOrigins/" + i0, schemaPath: "#/properties/allowedOrigins/items/type", keyword: "type", params: { type: "string" }, message: "must be string" }];
                    return false;
                  }
                  var valid1 = _errs4 === errors;
                  if (!valid1) {
                    break;
                  }
                }
              } else {
                validate26.errors = [{ instancePath: instancePath + "/allowedOrigins", schemaPath: "#/properties/allowedOrigins/type", keyword: "type", params: { type: "array" }, message: "must be array" }];
                return false;
              }
            }
            var valid0 = _errs2 === errors;
          } else {
            var valid0 = true;
          }
          if (valid0) {
            if (data.connection !== void 0) {
              const _errs6 = errors;
              if (!validate27(data.connection, { instancePath: instancePath + "/connection", parentData: data, parentDataProperty: "connection", rootData })) {
                vErrors = vErrors === null ? validate27.errors : vErrors.concat(validate27.errors);
                errors = vErrors.length;
              }
              var valid0 = _errs6 === errors;
            } else {
              var valid0 = true;
            }
            if (valid0) {
              if (data.cookieMode !== void 0) {
                let data3 = data.cookieMode;
                const _errs7 = errors;
                if (typeof data3 !== "string") {
                  validate26.errors = [{ instancePath: instancePath + "/cookieMode", schemaPath: "#/definitions/CookieMode/type", keyword: "type", params: { type: "string" }, message: "must be string" }];
                  return false;
                }
                if (!(data3 === "external" || data3 === "managed")) {
                  validate26.errors = [{ instancePath: instancePath + "/cookieMode", schemaPath: "#/definitions/CookieMode/enum", keyword: "enum", params: { allowedValues: schema45.enum }, message: "must be equal to one of the allowed values" }];
                  return false;
                }
                var valid0 = _errs7 === errors;
              } else {
                var valid0 = true;
              }
              if (valid0) {
                if (data.partition !== void 0) {
                  const _errs10 = errors;
                  if (typeof data.partition !== "string") {
                    validate26.errors = [{ instancePath: instancePath + "/partition", schemaPath: "#/properties/partition/type", keyword: "type", params: { type: "string" }, message: "must be string" }];
                    return false;
                  }
                  var valid0 = _errs10 === errors;
                } else {
                  var valid0 = true;
                }
                if (valid0) {
                  if (data.ttlMs !== void 0) {
                    let data5 = data.ttlMs;
                    const _errs12 = errors;
                    if (!(typeof data5 == "number" && (!(data5 % 1) && !isNaN(data5)) && isFinite(data5)) && data5 !== null) {
                      validate26.errors = [{ instancePath: instancePath + "/ttlMs", schemaPath: "#/properties/ttlMs/type", keyword: "type", params: { type: schema41.properties.ttlMs.type }, message: "must be integer,null" }];
                      return false;
                    }
                    if (errors === _errs12) {
                      if (typeof data5 == "number" && isFinite(data5)) {
                        if (data5 > 9007199254740991 || isNaN(data5)) {
                          validate26.errors = [{ instancePath: instancePath + "/ttlMs", schemaPath: "#/properties/ttlMs/maximum", keyword: "maximum", params: { comparison: "<=", limit: 9007199254740991 }, message: "must be <= 9007199254740991" }];
                          return false;
                        } else {
                          if (data5 < 0 || isNaN(data5)) {
                            validate26.errors = [{ instancePath: instancePath + "/ttlMs", schemaPath: "#/properties/ttlMs/minimum", keyword: "minimum", params: { comparison: ">=", limit: 0 }, message: "must be >= 0" }];
                            return false;
                          }
                        }
                      }
                    }
                    var valid0 = _errs12 === errors;
                  } else {
                    var valid0 = true;
                  }
                }
              }
            }
          }
        }
      }
    } else {
      validate26.errors = [{ instancePath, schemaPath: "#/type", keyword: "type", params: { type: "object" }, message: "must be object" }];
      return false;
    }
  }
  validate26.errors = vErrors;
  return errors === 0;
}
var cookieOperation = validate29;
var schema48 = { "additionalProperties": false, "properties": { "domain": { "type": "string" }, "expiresAtMs": { "format": "uint64", "minimum": 0, "type": ["integer", "null"], "maximum": 9007199254740991 }, "hostOnly": { "type": "boolean" }, "httpOnly": { "type": "boolean" }, "name": { "type": "string" }, "partitioned": { "type": "boolean" }, "path": { "type": "string" }, "sameSite": { "anyOf": [{ "$ref": "#/definitions/CookieSameSite" }, { "type": "null" }] }, "secure": { "type": "boolean" }, "value": { "type": "string" } }, "required": ["name", "value", "domain", "path", "secure", "httpOnly", "hostOnly", "partitioned"], "type": "object" };
var schema49 = { "enum": ["Strict", "Lax", "None"], "type": "string" };
function validate31(data, { instancePath = "", parentData, parentDataProperty, rootData = data } = {}) {
  let vErrors = null;
  let errors = 0;
  if (errors === 0) {
    if (data && typeof data == "object" && !Array.isArray(data)) {
      let missing0;
      if (data.name === void 0 && (missing0 = "name") || data.value === void 0 && (missing0 = "value") || data.domain === void 0 && (missing0 = "domain") || data.path === void 0 && (missing0 = "path") || data.secure === void 0 && (missing0 = "secure") || data.httpOnly === void 0 && (missing0 = "httpOnly") || data.hostOnly === void 0 && (missing0 = "hostOnly") || data.partitioned === void 0 && (missing0 = "partitioned")) {
        validate31.errors = [{ instancePath, schemaPath: "#/required", keyword: "required", params: { missingProperty: missing0 }, message: "must have required property '" + missing0 + "'" }];
        return false;
      } else {
        const _errs1 = errors;
        for (const key0 in data) {
          if (!func2.call(schema48.properties, key0)) {
            validate31.errors = [{ instancePath, schemaPath: "#/additionalProperties", keyword: "additionalProperties", params: { additionalProperty: key0 }, message: "must NOT have additional properties" }];
            return false;
            break;
          }
        }
        if (_errs1 === errors) {
          if (data.domain !== void 0) {
            const _errs2 = errors;
            if (typeof data.domain !== "string") {
              validate31.errors = [{ instancePath: instancePath + "/domain", schemaPath: "#/properties/domain/type", keyword: "type", params: { type: "string" }, message: "must be string" }];
              return false;
            }
            var valid0 = _errs2 === errors;
          } else {
            var valid0 = true;
          }
          if (valid0) {
            if (data.expiresAtMs !== void 0) {
              let data1 = data.expiresAtMs;
              const _errs4 = errors;
              if (!(typeof data1 == "number" && (!(data1 % 1) && !isNaN(data1)) && isFinite(data1)) && data1 !== null) {
                validate31.errors = [{ instancePath: instancePath + "/expiresAtMs", schemaPath: "#/properties/expiresAtMs/type", keyword: "type", params: { type: schema48.properties.expiresAtMs.type }, message: "must be integer,null" }];
                return false;
              }
              if (errors === _errs4) {
                if (typeof data1 == "number" && isFinite(data1)) {
                  if (data1 > 9007199254740991 || isNaN(data1)) {
                    validate31.errors = [{ instancePath: instancePath + "/expiresAtMs", schemaPath: "#/properties/expiresAtMs/maximum", keyword: "maximum", params: { comparison: "<=", limit: 9007199254740991 }, message: "must be <= 9007199254740991" }];
                    return false;
                  } else {
                    if (data1 < 0 || isNaN(data1)) {
                      validate31.errors = [{ instancePath: instancePath + "/expiresAtMs", schemaPath: "#/properties/expiresAtMs/minimum", keyword: "minimum", params: { comparison: ">=", limit: 0 }, message: "must be >= 0" }];
                      return false;
                    }
                  }
                }
              }
              var valid0 = _errs4 === errors;
            } else {
              var valid0 = true;
            }
            if (valid0) {
              if (data.hostOnly !== void 0) {
                const _errs6 = errors;
                if (typeof data.hostOnly !== "boolean") {
                  validate31.errors = [{ instancePath: instancePath + "/hostOnly", schemaPath: "#/properties/hostOnly/type", keyword: "type", params: { type: "boolean" }, message: "must be boolean" }];
                  return false;
                }
                var valid0 = _errs6 === errors;
              } else {
                var valid0 = true;
              }
              if (valid0) {
                if (data.httpOnly !== void 0) {
                  const _errs8 = errors;
                  if (typeof data.httpOnly !== "boolean") {
                    validate31.errors = [{ instancePath: instancePath + "/httpOnly", schemaPath: "#/properties/httpOnly/type", keyword: "type", params: { type: "boolean" }, message: "must be boolean" }];
                    return false;
                  }
                  var valid0 = _errs8 === errors;
                } else {
                  var valid0 = true;
                }
                if (valid0) {
                  if (data.name !== void 0) {
                    const _errs10 = errors;
                    if (typeof data.name !== "string") {
                      validate31.errors = [{ instancePath: instancePath + "/name", schemaPath: "#/properties/name/type", keyword: "type", params: { type: "string" }, message: "must be string" }];
                      return false;
                    }
                    var valid0 = _errs10 === errors;
                  } else {
                    var valid0 = true;
                  }
                  if (valid0) {
                    if (data.partitioned !== void 0) {
                      const _errs12 = errors;
                      if (typeof data.partitioned !== "boolean") {
                        validate31.errors = [{ instancePath: instancePath + "/partitioned", schemaPath: "#/properties/partitioned/type", keyword: "type", params: { type: "boolean" }, message: "must be boolean" }];
                        return false;
                      }
                      var valid0 = _errs12 === errors;
                    } else {
                      var valid0 = true;
                    }
                    if (valid0) {
                      if (data.path !== void 0) {
                        const _errs14 = errors;
                        if (typeof data.path !== "string") {
                          validate31.errors = [{ instancePath: instancePath + "/path", schemaPath: "#/properties/path/type", keyword: "type", params: { type: "string" }, message: "must be string" }];
                          return false;
                        }
                        var valid0 = _errs14 === errors;
                      } else {
                        var valid0 = true;
                      }
                      if (valid0) {
                        if (data.sameSite !== void 0) {
                          let data7 = data.sameSite;
                          const _errs16 = errors;
                          const _errs17 = errors;
                          let valid1 = false;
                          const _errs18 = errors;
                          if (typeof data7 !== "string") {
                            const err0 = { instancePath: instancePath + "/sameSite", schemaPath: "#/definitions/CookieSameSite/type", keyword: "type", params: { type: "string" }, message: "must be string" };
                            if (vErrors === null) {
                              vErrors = [err0];
                            } else {
                              vErrors.push(err0);
                            }
                            errors++;
                          }
                          if (!(data7 === "Strict" || data7 === "Lax" || data7 === "None")) {
                            const err1 = { instancePath: instancePath + "/sameSite", schemaPath: "#/definitions/CookieSameSite/enum", keyword: "enum", params: { allowedValues: schema49.enum }, message: "must be equal to one of the allowed values" };
                            if (vErrors === null) {
                              vErrors = [err1];
                            } else {
                              vErrors.push(err1);
                            }
                            errors++;
                          }
                          var _valid0 = _errs18 === errors;
                          valid1 = valid1 || _valid0;
                          if (!valid1) {
                            const _errs21 = errors;
                            if (data7 !== null) {
                              const err2 = { instancePath: instancePath + "/sameSite", schemaPath: "#/properties/sameSite/anyOf/1/type", keyword: "type", params: { type: "null" }, message: "must be null" };
                              if (vErrors === null) {
                                vErrors = [err2];
                              } else {
                                vErrors.push(err2);
                              }
                              errors++;
                            }
                            var _valid0 = _errs21 === errors;
                            valid1 = valid1 || _valid0;
                          }
                          if (!valid1) {
                            const err3 = { instancePath: instancePath + "/sameSite", schemaPath: "#/properties/sameSite/anyOf", keyword: "anyOf", params: {}, message: "must match a schema in anyOf" };
                            if (vErrors === null) {
                              vErrors = [err3];
                            } else {
                              vErrors.push(err3);
                            }
                            errors++;
                            validate31.errors = vErrors;
                            return false;
                          } else {
                            errors = _errs17;
                            if (vErrors !== null) {
                              if (_errs17) {
                                vErrors.length = _errs17;
                              } else {
                                vErrors = null;
                              }
                            }
                          }
                          var valid0 = _errs16 === errors;
                        } else {
                          var valid0 = true;
                        }
                        if (valid0) {
                          if (data.secure !== void 0) {
                            const _errs23 = errors;
                            if (typeof data.secure !== "boolean") {
                              validate31.errors = [{ instancePath: instancePath + "/secure", schemaPath: "#/properties/secure/type", keyword: "type", params: { type: "boolean" }, message: "must be boolean" }];
                              return false;
                            }
                            var valid0 = _errs23 === errors;
                          } else {
                            var valid0 = true;
                          }
                          if (valid0) {
                            if (data.value !== void 0) {
                              const _errs25 = errors;
                              if (typeof data.value !== "string") {
                                validate31.errors = [{ instancePath: instancePath + "/value", schemaPath: "#/properties/value/type", keyword: "type", params: { type: "string" }, message: "must be string" }];
                                return false;
                              }
                              var valid0 = _errs25 === errors;
                            } else {
                              var valid0 = true;
                            }
                          }
                        }
                      }
                    }
                  }
                }
              }
            }
          }
        }
      }
    } else {
      validate31.errors = [{ instancePath, schemaPath: "#/type", keyword: "type", params: { type: "object" }, message: "must be object" }];
      return false;
    }
  }
  validate31.errors = vErrors;
  return errors === 0;
}
function validate30(data, { instancePath = "", parentData, parentDataProperty, rootData = data } = {}) {
  let vErrors = null;
  let errors = 0;
  if (errors === 0) {
    if (data && typeof data == "object" && !Array.isArray(data)) {
      let missing0;
      if (data.partitionKey === void 0 && (missing0 = "partitionKey") || data.cookies === void 0 && (missing0 = "cookies")) {
        validate30.errors = [{ instancePath, schemaPath: "#/required", keyword: "required", params: { missingProperty: missing0 }, message: "must have required property '" + missing0 + "'" }];
        return false;
      } else {
        const _errs1 = errors;
        for (const key0 in data) {
          if (!(key0 === "cookies" || key0 === "partitionKey")) {
            validate30.errors = [{ instancePath, schemaPath: "#/additionalProperties", keyword: "additionalProperties", params: { additionalProperty: key0 }, message: "must NOT have additional properties" }];
            return false;
            break;
          }
        }
        if (_errs1 === errors) {
          if (data.cookies !== void 0) {
            let data0 = data.cookies;
            const _errs2 = errors;
            if (errors === _errs2) {
              if (Array.isArray(data0)) {
                var valid1 = true;
                const len0 = data0.length;
                for (let i0 = 0; i0 < len0; i0++) {
                  const _errs4 = errors;
                  if (!validate31(data0[i0], { instancePath: instancePath + "/cookies/" + i0, parentData: data0, parentDataProperty: i0, rootData })) {
                    vErrors = vErrors === null ? validate31.errors : vErrors.concat(validate31.errors);
                    errors = vErrors.length;
                  }
                  var valid1 = _errs4 === errors;
                  if (!valid1) {
                    break;
                  }
                }
              } else {
                validate30.errors = [{ instancePath: instancePath + "/cookies", schemaPath: "#/properties/cookies/type", keyword: "type", params: { type: "array" }, message: "must be array" }];
                return false;
              }
            }
            var valid0 = _errs2 === errors;
          } else {
            var valid0 = true;
          }
          if (valid0) {
            if (data.partitionKey !== void 0) {
              const _errs5 = errors;
              if (typeof data.partitionKey !== "string") {
                validate30.errors = [{ instancePath: instancePath + "/partitionKey", schemaPath: "#/properties/partitionKey/type", keyword: "type", params: { type: "string" }, message: "must be string" }];
                return false;
              }
              var valid0 = _errs5 === errors;
            } else {
              var valid0 = true;
            }
          }
        }
      }
    } else {
      validate30.errors = [{ instancePath, schemaPath: "#/type", keyword: "type", params: { type: "object" }, message: "must be object" }];
      return false;
    }
  }
  validate30.errors = vErrors;
  return errors === 0;
}
function validate29(data, { instancePath = "", parentData, parentDataProperty, rootData = data } = {}) {
  ;
  let vErrors = null;
  let errors = 0;
  const _errs0 = errors;
  let valid0 = false;
  let passing0 = null;
  const _errs1 = errors;
  if (errors === _errs1) {
    if (data && typeof data == "object" && !Array.isArray(data)) {
      let missing0;
      if (data.operation === void 0 && (missing0 = "operation") || data.partition === void 0 && (missing0 = "partition") || data.url === void 0 && (missing0 = "url")) {
        const err0 = { instancePath, schemaPath: "#/oneOf/0/required", keyword: "required", params: { missingProperty: missing0 }, message: "must have required property '" + missing0 + "'" };
        if (vErrors === null) {
          vErrors = [err0];
        } else {
          vErrors.push(err0);
        }
        errors++;
      } else {
        const _errs3 = errors;
        for (const key0 in data) {
          if (!(key0 === "operation" || key0 === "partition" || key0 === "url")) {
            const err1 = { instancePath, schemaPath: "#/oneOf/0/additionalProperties", keyword: "additionalProperties", params: { additionalProperty: key0 }, message: "must NOT have additional properties" };
            if (vErrors === null) {
              vErrors = [err1];
            } else {
              vErrors.push(err1);
            }
            errors++;
            break;
          }
        }
        if (_errs3 === errors) {
          if (data.operation !== void 0) {
            let data0 = data.operation;
            const _errs4 = errors;
            if (typeof data0 !== "string") {
              const err2 = { instancePath: instancePath + "/operation", schemaPath: "#/oneOf/0/properties/operation/type", keyword: "type", params: { type: "string" }, message: "must be string" };
              if (vErrors === null) {
                vErrors = [err2];
              } else {
                vErrors.push(err2);
              }
              errors++;
            }
            if ("select" !== data0) {
              const err3 = { instancePath: instancePath + "/operation", schemaPath: "#/oneOf/0/properties/operation/const", keyword: "const", params: { allowedValue: "select" }, message: "must be equal to constant" };
              if (vErrors === null) {
                vErrors = [err3];
              } else {
                vErrors.push(err3);
              }
              errors++;
            }
            var valid1 = _errs4 === errors;
          } else {
            var valid1 = true;
          }
          if (valid1) {
            if (data.partition !== void 0) {
              const _errs6 = errors;
              if (typeof data.partition !== "string") {
                const err4 = { instancePath: instancePath + "/partition", schemaPath: "#/oneOf/0/properties/partition/type", keyword: "type", params: { type: "string" }, message: "must be string" };
                if (vErrors === null) {
                  vErrors = [err4];
                } else {
                  vErrors.push(err4);
                }
                errors++;
              }
              var valid1 = _errs6 === errors;
            } else {
              var valid1 = true;
            }
            if (valid1) {
              if (data.url !== void 0) {
                const _errs8 = errors;
                if (typeof data.url !== "string") {
                  const err5 = { instancePath: instancePath + "/url", schemaPath: "#/oneOf/0/properties/url/type", keyword: "type", params: { type: "string" }, message: "must be string" };
                  if (vErrors === null) {
                    vErrors = [err5];
                  } else {
                    vErrors.push(err5);
                  }
                  errors++;
                }
                var valid1 = _errs8 === errors;
              } else {
                var valid1 = true;
              }
            }
          }
        }
      }
    } else {
      const err6 = { instancePath, schemaPath: "#/oneOf/0/type", keyword: "type", params: { type: "object" }, message: "must be object" };
      if (vErrors === null) {
        vErrors = [err6];
      } else {
        vErrors.push(err6);
      }
      errors++;
    }
  }
  var _valid0 = _errs1 === errors;
  if (_valid0) {
    valid0 = true;
    passing0 = 0;
  }
  const _errs10 = errors;
  if (errors === _errs10) {
    if (data && typeof data == "object" && !Array.isArray(data)) {
      let missing1;
      if (data.operation === void 0 && (missing1 = "operation") || data.partition === void 0 && (missing1 = "partition") || data.url === void 0 && (missing1 = "url") || data.cookies === void 0 && (missing1 = "cookies") || data.expectedRevision === void 0 && (missing1 = "expectedRevision")) {
        const err7 = { instancePath, schemaPath: "#/oneOf/1/required", keyword: "required", params: { missingProperty: missing1 }, message: "must have required property '" + missing1 + "'" };
        if (vErrors === null) {
          vErrors = [err7];
        } else {
          vErrors.push(err7);
        }
        errors++;
      } else {
        const _errs12 = errors;
        for (const key1 in data) {
          if (!(key1 === "cookies" || key1 === "expectedRevision" || key1 === "operation" || key1 === "partition" || key1 === "url")) {
            const err8 = { instancePath, schemaPath: "#/oneOf/1/additionalProperties", keyword: "additionalProperties", params: { additionalProperty: key1 }, message: "must NOT have additional properties" };
            if (vErrors === null) {
              vErrors = [err8];
            } else {
              vErrors.push(err8);
            }
            errors++;
            break;
          }
        }
        if (_errs12 === errors) {
          if (data.cookies !== void 0) {
            let data3 = data.cookies;
            const _errs13 = errors;
            if (errors === _errs13) {
              if (Array.isArray(data3)) {
                var valid3 = true;
                const len0 = data3.length;
                for (let i0 = 0; i0 < len0; i0++) {
                  const _errs15 = errors;
                  if (typeof data3[i0] !== "string") {
                    const err9 = { instancePath: instancePath + "/cookies/" + i0, schemaPath: "#/oneOf/1/properties/cookies/items/type", keyword: "type", params: { type: "string" }, message: "must be string" };
                    if (vErrors === null) {
                      vErrors = [err9];
                    } else {
                      vErrors.push(err9);
                    }
                    errors++;
                  }
                  var valid3 = _errs15 === errors;
                  if (!valid3) {
                    break;
                  }
                }
              } else {
                const err10 = { instancePath: instancePath + "/cookies", schemaPath: "#/oneOf/1/properties/cookies/type", keyword: "type", params: { type: "array" }, message: "must be array" };
                if (vErrors === null) {
                  vErrors = [err10];
                } else {
                  vErrors.push(err10);
                }
                errors++;
              }
            }
            var valid2 = _errs13 === errors;
          } else {
            var valid2 = true;
          }
          if (valid2) {
            if (data.expectedRevision !== void 0) {
              let data5 = data.expectedRevision;
              const _errs17 = errors;
              if (!(typeof data5 == "number" && (!(data5 % 1) && !isNaN(data5)) && isFinite(data5))) {
                const err11 = { instancePath: instancePath + "/expectedRevision", schemaPath: "#/oneOf/1/properties/expectedRevision/type", keyword: "type", params: { type: "integer" }, message: "must be integer" };
                if (vErrors === null) {
                  vErrors = [err11];
                } else {
                  vErrors.push(err11);
                }
                errors++;
              }
              if (errors === _errs17) {
                if (typeof data5 == "number" && isFinite(data5)) {
                  if (data5 > 9007199254740991 || isNaN(data5)) {
                    const err12 = { instancePath: instancePath + "/expectedRevision", schemaPath: "#/oneOf/1/properties/expectedRevision/maximum", keyword: "maximum", params: { comparison: "<=", limit: 9007199254740991 }, message: "must be <= 9007199254740991" };
                    if (vErrors === null) {
                      vErrors = [err12];
                    } else {
                      vErrors.push(err12);
                    }
                    errors++;
                  } else {
                    if (data5 < 0 || isNaN(data5)) {
                      const err13 = { instancePath: instancePath + "/expectedRevision", schemaPath: "#/oneOf/1/properties/expectedRevision/minimum", keyword: "minimum", params: { comparison: ">=", limit: 0 }, message: "must be >= 0" };
                      if (vErrors === null) {
                        vErrors = [err13];
                      } else {
                        vErrors.push(err13);
                      }
                      errors++;
                    }
                  }
                }
              }
              var valid2 = _errs17 === errors;
            } else {
              var valid2 = true;
            }
            if (valid2) {
              if (data.operation !== void 0) {
                let data6 = data.operation;
                const _errs19 = errors;
                if (typeof data6 !== "string") {
                  const err14 = { instancePath: instancePath + "/operation", schemaPath: "#/oneOf/1/properties/operation/type", keyword: "type", params: { type: "string" }, message: "must be string" };
                  if (vErrors === null) {
                    vErrors = [err14];
                  } else {
                    vErrors.push(err14);
                  }
                  errors++;
                }
                if ("set" !== data6) {
                  const err15 = { instancePath: instancePath + "/operation", schemaPath: "#/oneOf/1/properties/operation/const", keyword: "const", params: { allowedValue: "set" }, message: "must be equal to constant" };
                  if (vErrors === null) {
                    vErrors = [err15];
                  } else {
                    vErrors.push(err15);
                  }
                  errors++;
                }
                var valid2 = _errs19 === errors;
              } else {
                var valid2 = true;
              }
              if (valid2) {
                if (data.partition !== void 0) {
                  const _errs21 = errors;
                  if (typeof data.partition !== "string") {
                    const err16 = { instancePath: instancePath + "/partition", schemaPath: "#/oneOf/1/properties/partition/type", keyword: "type", params: { type: "string" }, message: "must be string" };
                    if (vErrors === null) {
                      vErrors = [err16];
                    } else {
                      vErrors.push(err16);
                    }
                    errors++;
                  }
                  var valid2 = _errs21 === errors;
                } else {
                  var valid2 = true;
                }
                if (valid2) {
                  if (data.url !== void 0) {
                    const _errs23 = errors;
                    if (typeof data.url !== "string") {
                      const err17 = { instancePath: instancePath + "/url", schemaPath: "#/oneOf/1/properties/url/type", keyword: "type", params: { type: "string" }, message: "must be string" };
                      if (vErrors === null) {
                        vErrors = [err17];
                      } else {
                        vErrors.push(err17);
                      }
                      errors++;
                    }
                    var valid2 = _errs23 === errors;
                  } else {
                    var valid2 = true;
                  }
                }
              }
            }
          }
        }
      }
    } else {
      const err18 = { instancePath, schemaPath: "#/oneOf/1/type", keyword: "type", params: { type: "object" }, message: "must be object" };
      if (vErrors === null) {
        vErrors = [err18];
      } else {
        vErrors.push(err18);
      }
      errors++;
    }
  }
  var _valid0 = _errs10 === errors;
  if (_valid0 && valid0) {
    valid0 = false;
    passing0 = [passing0, 1];
  } else {
    if (_valid0) {
      valid0 = true;
      passing0 = 1;
    }
    const _errs25 = errors;
    if (errors === _errs25) {
      if (data && typeof data == "object" && !Array.isArray(data)) {
        let missing2;
        if (data.operation === void 0 && (missing2 = "operation") || data.partition === void 0 && (missing2 = "partition")) {
          const err19 = { instancePath, schemaPath: "#/oneOf/2/required", keyword: "required", params: { missingProperty: missing2 }, message: "must have required property '" + missing2 + "'" };
          if (vErrors === null) {
            vErrors = [err19];
          } else {
            vErrors.push(err19);
          }
          errors++;
        } else {
          const _errs27 = errors;
          for (const key2 in data) {
            if (!(key2 === "operation" || key2 === "partition")) {
              const err20 = { instancePath, schemaPath: "#/oneOf/2/additionalProperties", keyword: "additionalProperties", params: { additionalProperty: key2 }, message: "must NOT have additional properties" };
              if (vErrors === null) {
                vErrors = [err20];
              } else {
                vErrors.push(err20);
              }
              errors++;
              break;
            }
          }
          if (_errs27 === errors) {
            if (data.operation !== void 0) {
              let data9 = data.operation;
              const _errs28 = errors;
              if (typeof data9 !== "string") {
                const err21 = { instancePath: instancePath + "/operation", schemaPath: "#/oneOf/2/properties/operation/type", keyword: "type", params: { type: "string" }, message: "must be string" };
                if (vErrors === null) {
                  vErrors = [err21];
                } else {
                  vErrors.push(err21);
                }
                errors++;
              }
              if ("export" !== data9) {
                const err22 = { instancePath: instancePath + "/operation", schemaPath: "#/oneOf/2/properties/operation/const", keyword: "const", params: { allowedValue: "export" }, message: "must be equal to constant" };
                if (vErrors === null) {
                  vErrors = [err22];
                } else {
                  vErrors.push(err22);
                }
                errors++;
              }
              var valid4 = _errs28 === errors;
            } else {
              var valid4 = true;
            }
            if (valid4) {
              if (data.partition !== void 0) {
                const _errs30 = errors;
                if (typeof data.partition !== "string") {
                  const err23 = { instancePath: instancePath + "/partition", schemaPath: "#/oneOf/2/properties/partition/type", keyword: "type", params: { type: "string" }, message: "must be string" };
                  if (vErrors === null) {
                    vErrors = [err23];
                  } else {
                    vErrors.push(err23);
                  }
                  errors++;
                }
                var valid4 = _errs30 === errors;
              } else {
                var valid4 = true;
              }
            }
          }
        }
      } else {
        const err24 = { instancePath, schemaPath: "#/oneOf/2/type", keyword: "type", params: { type: "object" }, message: "must be object" };
        if (vErrors === null) {
          vErrors = [err24];
        } else {
          vErrors.push(err24);
        }
        errors++;
      }
    }
    var _valid0 = _errs25 === errors;
    if (_valid0 && valid0) {
      valid0 = false;
      passing0 = [passing0, 2];
    } else {
      if (_valid0) {
        valid0 = true;
        passing0 = 2;
      }
      const _errs32 = errors;
      if (errors === _errs32) {
        if (data && typeof data == "object" && !Array.isArray(data)) {
          let missing3;
          if (data.operation === void 0 && (missing3 = "operation") || data.partition === void 0 && (missing3 = "partition") || data.snapshot === void 0 && (missing3 = "snapshot") || data.expectedRevision === void 0 && (missing3 = "expectedRevision")) {
            const err25 = { instancePath, schemaPath: "#/oneOf/3/required", keyword: "required", params: { missingProperty: missing3 }, message: "must have required property '" + missing3 + "'" };
            if (vErrors === null) {
              vErrors = [err25];
            } else {
              vErrors.push(err25);
            }
            errors++;
          } else {
            const _errs34 = errors;
            for (const key3 in data) {
              if (!(key3 === "expectedRevision" || key3 === "operation" || key3 === "partition" || key3 === "snapshot")) {
                const err26 = { instancePath, schemaPath: "#/oneOf/3/additionalProperties", keyword: "additionalProperties", params: { additionalProperty: key3 }, message: "must NOT have additional properties" };
                if (vErrors === null) {
                  vErrors = [err26];
                } else {
                  vErrors.push(err26);
                }
                errors++;
                break;
              }
            }
            if (_errs34 === errors) {
              if (data.expectedRevision !== void 0) {
                let data11 = data.expectedRevision;
                const _errs35 = errors;
                if (!(typeof data11 == "number" && (!(data11 % 1) && !isNaN(data11)) && isFinite(data11))) {
                  const err27 = { instancePath: instancePath + "/expectedRevision", schemaPath: "#/oneOf/3/properties/expectedRevision/type", keyword: "type", params: { type: "integer" }, message: "must be integer" };
                  if (vErrors === null) {
                    vErrors = [err27];
                  } else {
                    vErrors.push(err27);
                  }
                  errors++;
                }
                if (errors === _errs35) {
                  if (typeof data11 == "number" && isFinite(data11)) {
                    if (data11 > 9007199254740991 || isNaN(data11)) {
                      const err28 = { instancePath: instancePath + "/expectedRevision", schemaPath: "#/oneOf/3/properties/expectedRevision/maximum", keyword: "maximum", params: { comparison: "<=", limit: 9007199254740991 }, message: "must be <= 9007199254740991" };
                      if (vErrors === null) {
                        vErrors = [err28];
                      } else {
                        vErrors.push(err28);
                      }
                      errors++;
                    } else {
                      if (data11 < 0 || isNaN(data11)) {
                        const err29 = { instancePath: instancePath + "/expectedRevision", schemaPath: "#/oneOf/3/properties/expectedRevision/minimum", keyword: "minimum", params: { comparison: ">=", limit: 0 }, message: "must be >= 0" };
                        if (vErrors === null) {
                          vErrors = [err29];
                        } else {
                          vErrors.push(err29);
                        }
                        errors++;
                      }
                    }
                  }
                }
                var valid5 = _errs35 === errors;
              } else {
                var valid5 = true;
              }
              if (valid5) {
                if (data.operation !== void 0) {
                  let data12 = data.operation;
                  const _errs37 = errors;
                  if (typeof data12 !== "string") {
                    const err30 = { instancePath: instancePath + "/operation", schemaPath: "#/oneOf/3/properties/operation/type", keyword: "type", params: { type: "string" }, message: "must be string" };
                    if (vErrors === null) {
                      vErrors = [err30];
                    } else {
                      vErrors.push(err30);
                    }
                    errors++;
                  }
                  if ("import" !== data12) {
                    const err31 = { instancePath: instancePath + "/operation", schemaPath: "#/oneOf/3/properties/operation/const", keyword: "const", params: { allowedValue: "import" }, message: "must be equal to constant" };
                    if (vErrors === null) {
                      vErrors = [err31];
                    } else {
                      vErrors.push(err31);
                    }
                    errors++;
                  }
                  var valid5 = _errs37 === errors;
                } else {
                  var valid5 = true;
                }
                if (valid5) {
                  if (data.partition !== void 0) {
                    const _errs39 = errors;
                    if (typeof data.partition !== "string") {
                      const err32 = { instancePath: instancePath + "/partition", schemaPath: "#/oneOf/3/properties/partition/type", keyword: "type", params: { type: "string" }, message: "must be string" };
                      if (vErrors === null) {
                        vErrors = [err32];
                      } else {
                        vErrors.push(err32);
                      }
                      errors++;
                    }
                    var valid5 = _errs39 === errors;
                  } else {
                    var valid5 = true;
                  }
                  if (valid5) {
                    if (data.snapshot !== void 0) {
                      const _errs41 = errors;
                      if (!validate30(data.snapshot, { instancePath: instancePath + "/snapshot", parentData: data, parentDataProperty: "snapshot", rootData })) {
                        vErrors = vErrors === null ? validate30.errors : vErrors.concat(validate30.errors);
                        errors = vErrors.length;
                      }
                      var valid5 = _errs41 === errors;
                    } else {
                      var valid5 = true;
                    }
                  }
                }
              }
            }
          }
        } else {
          const err33 = { instancePath, schemaPath: "#/oneOf/3/type", keyword: "type", params: { type: "object" }, message: "must be object" };
          if (vErrors === null) {
            vErrors = [err33];
          } else {
            vErrors.push(err33);
          }
          errors++;
        }
      }
      var _valid0 = _errs32 === errors;
      if (_valid0 && valid0) {
        valid0 = false;
        passing0 = [passing0, 3];
      } else {
        if (_valid0) {
          valid0 = true;
          passing0 = 3;
        }
      }
    }
  }
  if (!valid0) {
    const err34 = { instancePath, schemaPath: "#/oneOf", keyword: "oneOf", params: { passingSchemas: passing0 }, message: "must match exactly one schema in oneOf" };
    if (vErrors === null) {
      vErrors = [err34];
    } else {
      vErrors.push(err34);
    }
    errors++;
    validate29.errors = vErrors;
    return false;
  } else {
    errors = _errs0;
    if (vErrors !== null) {
      if (_errs0) {
        vErrors.length = _errs0;
      } else {
        vErrors = null;
      }
    }
  }
  validate29.errors = vErrors;
  return errors === 0;
}
var cookieReply = validate34;
var schema50 = { "$id": "https://ja3proxy.invalid/contracts/cookieReply.schema.json", "$schema": "http://json-schema.org/draft-07/schema#", "definitions": { "CookieRecord": { "additionalProperties": false, "properties": { "domain": { "type": "string" }, "expiresAtMs": { "format": "uint64", "minimum": 0, "type": ["integer", "null"], "maximum": 9007199254740991 }, "hostOnly": { "type": "boolean" }, "httpOnly": { "type": "boolean" }, "name": { "type": "string" }, "partitioned": { "type": "boolean" }, "path": { "type": "string" }, "sameSite": { "anyOf": [{ "$ref": "#/definitions/CookieSameSite" }, { "type": "null" }] }, "secure": { "type": "boolean" }, "value": { "type": "string" } }, "required": ["name", "value", "domain", "path", "secure", "httpOnly", "hostOnly", "partitioned"], "type": "object" }, "CookieSameSite": { "enum": ["Strict", "Lax", "None"], "type": "string" }, "CookieSnapshot": { "additionalProperties": false, "properties": { "cookies": { "items": { "$ref": "#/definitions/CookieRecord" }, "type": "array" }, "partitionKey": { "type": "string" } }, "required": ["partitionKey", "cookies"], "type": "object" } }, "properties": { "cookies": { "items": { "$ref": "#/definitions/CookieRecord" }, "type": ["array", "null"] }, "revision": { "format": "uint64", "minimum": 0, "type": "integer", "maximum": 9007199254740991 }, "snapshot": { "anyOf": [{ "$ref": "#/definitions/CookieSnapshot" }, { "type": "null" }] } }, "required": ["revision"], "title": "CookieReply", "type": "object" };
var schema51 = { "additionalProperties": false, "properties": { "domain": { "type": "string" }, "expiresAtMs": { "format": "uint64", "minimum": 0, "type": ["integer", "null"], "maximum": 9007199254740991 }, "hostOnly": { "type": "boolean" }, "httpOnly": { "type": "boolean" }, "name": { "type": "string" }, "partitioned": { "type": "boolean" }, "path": { "type": "string" }, "sameSite": { "anyOf": [{ "$ref": "#/definitions/CookieSameSite" }, { "type": "null" }] }, "secure": { "type": "boolean" }, "value": { "type": "string" } }, "required": ["name", "value", "domain", "path", "secure", "httpOnly", "hostOnly", "partitioned"], "type": "object" };
var schema52 = { "enum": ["Strict", "Lax", "None"], "type": "string" };
function validate35(data, { instancePath = "", parentData, parentDataProperty, rootData = data } = {}) {
  let vErrors = null;
  let errors = 0;
  if (errors === 0) {
    if (data && typeof data == "object" && !Array.isArray(data)) {
      let missing0;
      if (data.name === void 0 && (missing0 = "name") || data.value === void 0 && (missing0 = "value") || data.domain === void 0 && (missing0 = "domain") || data.path === void 0 && (missing0 = "path") || data.secure === void 0 && (missing0 = "secure") || data.httpOnly === void 0 && (missing0 = "httpOnly") || data.hostOnly === void 0 && (missing0 = "hostOnly") || data.partitioned === void 0 && (missing0 = "partitioned")) {
        validate35.errors = [{ instancePath, schemaPath: "#/required", keyword: "required", params: { missingProperty: missing0 }, message: "must have required property '" + missing0 + "'" }];
        return false;
      } else {
        const _errs1 = errors;
        for (const key0 in data) {
          if (!func2.call(schema51.properties, key0)) {
            validate35.errors = [{ instancePath, schemaPath: "#/additionalProperties", keyword: "additionalProperties", params: { additionalProperty: key0 }, message: "must NOT have additional properties" }];
            return false;
            break;
          }
        }
        if (_errs1 === errors) {
          if (data.domain !== void 0) {
            const _errs2 = errors;
            if (typeof data.domain !== "string") {
              validate35.errors = [{ instancePath: instancePath + "/domain", schemaPath: "#/properties/domain/type", keyword: "type", params: { type: "string" }, message: "must be string" }];
              return false;
            }
            var valid0 = _errs2 === errors;
          } else {
            var valid0 = true;
          }
          if (valid0) {
            if (data.expiresAtMs !== void 0) {
              let data1 = data.expiresAtMs;
              const _errs4 = errors;
              if (!(typeof data1 == "number" && (!(data1 % 1) && !isNaN(data1)) && isFinite(data1)) && data1 !== null) {
                validate35.errors = [{ instancePath: instancePath + "/expiresAtMs", schemaPath: "#/properties/expiresAtMs/type", keyword: "type", params: { type: schema51.properties.expiresAtMs.type }, message: "must be integer,null" }];
                return false;
              }
              if (errors === _errs4) {
                if (typeof data1 == "number" && isFinite(data1)) {
                  if (data1 > 9007199254740991 || isNaN(data1)) {
                    validate35.errors = [{ instancePath: instancePath + "/expiresAtMs", schemaPath: "#/properties/expiresAtMs/maximum", keyword: "maximum", params: { comparison: "<=", limit: 9007199254740991 }, message: "must be <= 9007199254740991" }];
                    return false;
                  } else {
                    if (data1 < 0 || isNaN(data1)) {
                      validate35.errors = [{ instancePath: instancePath + "/expiresAtMs", schemaPath: "#/properties/expiresAtMs/minimum", keyword: "minimum", params: { comparison: ">=", limit: 0 }, message: "must be >= 0" }];
                      return false;
                    }
                  }
                }
              }
              var valid0 = _errs4 === errors;
            } else {
              var valid0 = true;
            }
            if (valid0) {
              if (data.hostOnly !== void 0) {
                const _errs6 = errors;
                if (typeof data.hostOnly !== "boolean") {
                  validate35.errors = [{ instancePath: instancePath + "/hostOnly", schemaPath: "#/properties/hostOnly/type", keyword: "type", params: { type: "boolean" }, message: "must be boolean" }];
                  return false;
                }
                var valid0 = _errs6 === errors;
              } else {
                var valid0 = true;
              }
              if (valid0) {
                if (data.httpOnly !== void 0) {
                  const _errs8 = errors;
                  if (typeof data.httpOnly !== "boolean") {
                    validate35.errors = [{ instancePath: instancePath + "/httpOnly", schemaPath: "#/properties/httpOnly/type", keyword: "type", params: { type: "boolean" }, message: "must be boolean" }];
                    return false;
                  }
                  var valid0 = _errs8 === errors;
                } else {
                  var valid0 = true;
                }
                if (valid0) {
                  if (data.name !== void 0) {
                    const _errs10 = errors;
                    if (typeof data.name !== "string") {
                      validate35.errors = [{ instancePath: instancePath + "/name", schemaPath: "#/properties/name/type", keyword: "type", params: { type: "string" }, message: "must be string" }];
                      return false;
                    }
                    var valid0 = _errs10 === errors;
                  } else {
                    var valid0 = true;
                  }
                  if (valid0) {
                    if (data.partitioned !== void 0) {
                      const _errs12 = errors;
                      if (typeof data.partitioned !== "boolean") {
                        validate35.errors = [{ instancePath: instancePath + "/partitioned", schemaPath: "#/properties/partitioned/type", keyword: "type", params: { type: "boolean" }, message: "must be boolean" }];
                        return false;
                      }
                      var valid0 = _errs12 === errors;
                    } else {
                      var valid0 = true;
                    }
                    if (valid0) {
                      if (data.path !== void 0) {
                        const _errs14 = errors;
                        if (typeof data.path !== "string") {
                          validate35.errors = [{ instancePath: instancePath + "/path", schemaPath: "#/properties/path/type", keyword: "type", params: { type: "string" }, message: "must be string" }];
                          return false;
                        }
                        var valid0 = _errs14 === errors;
                      } else {
                        var valid0 = true;
                      }
                      if (valid0) {
                        if (data.sameSite !== void 0) {
                          let data7 = data.sameSite;
                          const _errs16 = errors;
                          const _errs17 = errors;
                          let valid1 = false;
                          const _errs18 = errors;
                          if (typeof data7 !== "string") {
                            const err0 = { instancePath: instancePath + "/sameSite", schemaPath: "#/definitions/CookieSameSite/type", keyword: "type", params: { type: "string" }, message: "must be string" };
                            if (vErrors === null) {
                              vErrors = [err0];
                            } else {
                              vErrors.push(err0);
                            }
                            errors++;
                          }
                          if (!(data7 === "Strict" || data7 === "Lax" || data7 === "None")) {
                            const err1 = { instancePath: instancePath + "/sameSite", schemaPath: "#/definitions/CookieSameSite/enum", keyword: "enum", params: { allowedValues: schema52.enum }, message: "must be equal to one of the allowed values" };
                            if (vErrors === null) {
                              vErrors = [err1];
                            } else {
                              vErrors.push(err1);
                            }
                            errors++;
                          }
                          var _valid0 = _errs18 === errors;
                          valid1 = valid1 || _valid0;
                          if (!valid1) {
                            const _errs21 = errors;
                            if (data7 !== null) {
                              const err2 = { instancePath: instancePath + "/sameSite", schemaPath: "#/properties/sameSite/anyOf/1/type", keyword: "type", params: { type: "null" }, message: "must be null" };
                              if (vErrors === null) {
                                vErrors = [err2];
                              } else {
                                vErrors.push(err2);
                              }
                              errors++;
                            }
                            var _valid0 = _errs21 === errors;
                            valid1 = valid1 || _valid0;
                          }
                          if (!valid1) {
                            const err3 = { instancePath: instancePath + "/sameSite", schemaPath: "#/properties/sameSite/anyOf", keyword: "anyOf", params: {}, message: "must match a schema in anyOf" };
                            if (vErrors === null) {
                              vErrors = [err3];
                            } else {
                              vErrors.push(err3);
                            }
                            errors++;
                            validate35.errors = vErrors;
                            return false;
                          } else {
                            errors = _errs17;
                            if (vErrors !== null) {
                              if (_errs17) {
                                vErrors.length = _errs17;
                              } else {
                                vErrors = null;
                              }
                            }
                          }
                          var valid0 = _errs16 === errors;
                        } else {
                          var valid0 = true;
                        }
                        if (valid0) {
                          if (data.secure !== void 0) {
                            const _errs23 = errors;
                            if (typeof data.secure !== "boolean") {
                              validate35.errors = [{ instancePath: instancePath + "/secure", schemaPath: "#/properties/secure/type", keyword: "type", params: { type: "boolean" }, message: "must be boolean" }];
                              return false;
                            }
                            var valid0 = _errs23 === errors;
                          } else {
                            var valid0 = true;
                          }
                          if (valid0) {
                            if (data.value !== void 0) {
                              const _errs25 = errors;
                              if (typeof data.value !== "string") {
                                validate35.errors = [{ instancePath: instancePath + "/value", schemaPath: "#/properties/value/type", keyword: "type", params: { type: "string" }, message: "must be string" }];
                                return false;
                              }
                              var valid0 = _errs25 === errors;
                            } else {
                              var valid0 = true;
                            }
                          }
                        }
                      }
                    }
                  }
                }
              }
            }
          }
        }
      }
    } else {
      validate35.errors = [{ instancePath, schemaPath: "#/type", keyword: "type", params: { type: "object" }, message: "must be object" }];
      return false;
    }
  }
  validate35.errors = vErrors;
  return errors === 0;
}
function validate37(data, { instancePath = "", parentData, parentDataProperty, rootData = data } = {}) {
  let vErrors = null;
  let errors = 0;
  if (errors === 0) {
    if (data && typeof data == "object" && !Array.isArray(data)) {
      let missing0;
      if (data.partitionKey === void 0 && (missing0 = "partitionKey") || data.cookies === void 0 && (missing0 = "cookies")) {
        validate37.errors = [{ instancePath, schemaPath: "#/required", keyword: "required", params: { missingProperty: missing0 }, message: "must have required property '" + missing0 + "'" }];
        return false;
      } else {
        const _errs1 = errors;
        for (const key0 in data) {
          if (!(key0 === "cookies" || key0 === "partitionKey")) {
            validate37.errors = [{ instancePath, schemaPath: "#/additionalProperties", keyword: "additionalProperties", params: { additionalProperty: key0 }, message: "must NOT have additional properties" }];
            return false;
            break;
          }
        }
        if (_errs1 === errors) {
          if (data.cookies !== void 0) {
            let data0 = data.cookies;
            const _errs2 = errors;
            if (errors === _errs2) {
              if (Array.isArray(data0)) {
                var valid1 = true;
                const len0 = data0.length;
                for (let i0 = 0; i0 < len0; i0++) {
                  const _errs4 = errors;
                  if (!validate35(data0[i0], { instancePath: instancePath + "/cookies/" + i0, parentData: data0, parentDataProperty: i0, rootData })) {
                    vErrors = vErrors === null ? validate35.errors : vErrors.concat(validate35.errors);
                    errors = vErrors.length;
                  }
                  var valid1 = _errs4 === errors;
                  if (!valid1) {
                    break;
                  }
                }
              } else {
                validate37.errors = [{ instancePath: instancePath + "/cookies", schemaPath: "#/properties/cookies/type", keyword: "type", params: { type: "array" }, message: "must be array" }];
                return false;
              }
            }
            var valid0 = _errs2 === errors;
          } else {
            var valid0 = true;
          }
          if (valid0) {
            if (data.partitionKey !== void 0) {
              const _errs5 = errors;
              if (typeof data.partitionKey !== "string") {
                validate37.errors = [{ instancePath: instancePath + "/partitionKey", schemaPath: "#/properties/partitionKey/type", keyword: "type", params: { type: "string" }, message: "must be string" }];
                return false;
              }
              var valid0 = _errs5 === errors;
            } else {
              var valid0 = true;
            }
          }
        }
      }
    } else {
      validate37.errors = [{ instancePath, schemaPath: "#/type", keyword: "type", params: { type: "object" }, message: "must be object" }];
      return false;
    }
  }
  validate37.errors = vErrors;
  return errors === 0;
}
function validate34(data, { instancePath = "", parentData, parentDataProperty, rootData = data } = {}) {
  ;
  let vErrors = null;
  let errors = 0;
  if (errors === 0) {
    if (data && typeof data == "object" && !Array.isArray(data)) {
      let missing0;
      if (data.revision === void 0 && (missing0 = "revision")) {
        validate34.errors = [{ instancePath, schemaPath: "#/required", keyword: "required", params: { missingProperty: missing0 }, message: "must have required property '" + missing0 + "'" }];
        return false;
      } else {
        if (data.cookies !== void 0) {
          let data0 = data.cookies;
          const _errs1 = errors;
          if (!Array.isArray(data0) && data0 !== null) {
            validate34.errors = [{ instancePath: instancePath + "/cookies", schemaPath: "#/properties/cookies/type", keyword: "type", params: { type: schema50.properties.cookies.type }, message: "must be array,null" }];
            return false;
          }
          if (errors === _errs1) {
            if (Array.isArray(data0)) {
              var valid1 = true;
              const len0 = data0.length;
              for (let i0 = 0; i0 < len0; i0++) {
                const _errs3 = errors;
                if (!validate35(data0[i0], { instancePath: instancePath + "/cookies/" + i0, parentData: data0, parentDataProperty: i0, rootData })) {
                  vErrors = vErrors === null ? validate35.errors : vErrors.concat(validate35.errors);
                  errors = vErrors.length;
                }
                var valid1 = _errs3 === errors;
                if (!valid1) {
                  break;
                }
              }
            }
          }
          var valid0 = _errs1 === errors;
        } else {
          var valid0 = true;
        }
        if (valid0) {
          if (data.revision !== void 0) {
            let data2 = data.revision;
            const _errs4 = errors;
            if (!(typeof data2 == "number" && (!(data2 % 1) && !isNaN(data2)) && isFinite(data2))) {
              validate34.errors = [{ instancePath: instancePath + "/revision", schemaPath: "#/properties/revision/type", keyword: "type", params: { type: "integer" }, message: "must be integer" }];
              return false;
            }
            if (errors === _errs4) {
              if (typeof data2 == "number" && isFinite(data2)) {
                if (data2 > 9007199254740991 || isNaN(data2)) {
                  validate34.errors = [{ instancePath: instancePath + "/revision", schemaPath: "#/properties/revision/maximum", keyword: "maximum", params: { comparison: "<=", limit: 9007199254740991 }, message: "must be <= 9007199254740991" }];
                  return false;
                } else {
                  if (data2 < 0 || isNaN(data2)) {
                    validate34.errors = [{ instancePath: instancePath + "/revision", schemaPath: "#/properties/revision/minimum", keyword: "minimum", params: { comparison: ">=", limit: 0 }, message: "must be >= 0" }];
                    return false;
                  }
                }
              }
            }
            var valid0 = _errs4 === errors;
          } else {
            var valid0 = true;
          }
          if (valid0) {
            if (data.snapshot !== void 0) {
              let data3 = data.snapshot;
              const _errs6 = errors;
              const _errs7 = errors;
              let valid2 = false;
              const _errs8 = errors;
              if (!validate37(data3, { instancePath: instancePath + "/snapshot", parentData: data, parentDataProperty: "snapshot", rootData })) {
                vErrors = vErrors === null ? validate37.errors : vErrors.concat(validate37.errors);
                errors = vErrors.length;
              }
              var _valid0 = _errs8 === errors;
              valid2 = valid2 || _valid0;
              if (!valid2) {
                const _errs9 = errors;
                if (data3 !== null) {
                  const err0 = { instancePath: instancePath + "/snapshot", schemaPath: "#/properties/snapshot/anyOf/1/type", keyword: "type", params: { type: "null" }, message: "must be null" };
                  if (vErrors === null) {
                    vErrors = [err0];
                  } else {
                    vErrors.push(err0);
                  }
                  errors++;
                }
                var _valid0 = _errs9 === errors;
                valid2 = valid2 || _valid0;
              }
              if (!valid2) {
                const err1 = { instancePath: instancePath + "/snapshot", schemaPath: "#/properties/snapshot/anyOf", keyword: "anyOf", params: {}, message: "must match a schema in anyOf" };
                if (vErrors === null) {
                  vErrors = [err1];
                } else {
                  vErrors.push(err1);
                }
                errors++;
                validate34.errors = vErrors;
                return false;
              } else {
                errors = _errs7;
                if (vErrors !== null) {
                  if (_errs7) {
                    vErrors.length = _errs7;
                  } else {
                    vErrors = null;
                  }
                }
              }
              var valid0 = _errs6 === errors;
            } else {
              var valid0 = true;
            }
          }
        }
      }
    } else {
      validate34.errors = [{ instancePath, schemaPath: "#/type", keyword: "type", params: { type: "object" }, message: "must be object" }];
      return false;
    }
  }
  validate34.errors = vErrors;
  return errors === 0;
}
var requestStatus = validate40;
var schema60 = { "enum": ["queued", "active", "complete", "failed"], "type": "string" };
var schema55 = { "properties": { "attempt": { "format": "uint64", "minimum": 0, "type": "integer", "maximum": 9007199254740991 }, "bodyMs": { "format": "uint64", "minimum": 0, "type": ["integer", "null"], "maximum": 9007199254740991 }, "clientReused": { "type": ["boolean", "null"] }, "contextId": { "type": ["string", "null"] }, "cookieRevision": { "format": "uint64", "minimum": 0, "type": ["integer", "null"], "maximum": 9007199254740991 }, "delivery": { "$ref": "#/definitions/Delivery" }, "headersMs": { "format": "uint64", "minimum": 0, "type": ["integer", "null"], "maximum": 9007199254740991 }, "phase": { "$ref": "#/definitions/Phase" }, "queueMs": { "format": "uint64", "minimum": 0, "type": "integer", "maximum": 9007199254740991 }, "requestBytes": { "format": "uint64", "minimum": 0, "type": "integer", "maximum": 9007199254740991 }, "requestId": { "type": "string" }, "responseBytes": { "format": "uint64", "minimum": 0, "type": "integer", "maximum": 9007199254740991 }, "tlsProfile": { "type": "string" }, "totalMs": { "format": "uint64", "minimum": 0, "type": "integer", "maximum": 9007199254740991 }, "traceId": { "type": ["string", "null"] } }, "required": ["requestId", "attempt", "phase", "delivery", "queueMs", "headersMs", "bodyMs", "totalMs", "requestBytes", "responseBytes", "tlsProfile"], "type": "object" };
var schema56 = { "enum": ["not_started", "possibly_sent", "response_started"], "type": "string" };
var schema57 = { "enum": ["queued", "preparing", "upstream", "body", "complete"], "type": "string" };
function validate41(data, { instancePath = "", parentData, parentDataProperty, rootData = data } = {}) {
  let vErrors = null;
  let errors = 0;
  if (errors === 0) {
    if (data && typeof data == "object" && !Array.isArray(data)) {
      let missing0;
      if (data.requestId === void 0 && (missing0 = "requestId") || data.attempt === void 0 && (missing0 = "attempt") || data.phase === void 0 && (missing0 = "phase") || data.delivery === void 0 && (missing0 = "delivery") || data.queueMs === void 0 && (missing0 = "queueMs") || data.headersMs === void 0 && (missing0 = "headersMs") || data.bodyMs === void 0 && (missing0 = "bodyMs") || data.totalMs === void 0 && (missing0 = "totalMs") || data.requestBytes === void 0 && (missing0 = "requestBytes") || data.responseBytes === void 0 && (missing0 = "responseBytes") || data.tlsProfile === void 0 && (missing0 = "tlsProfile")) {
        validate41.errors = [{ instancePath, schemaPath: "#/required", keyword: "required", params: { missingProperty: missing0 }, message: "must have required property '" + missing0 + "'" }];
        return false;
      } else {
        if (data.attempt !== void 0) {
          let data0 = data.attempt;
          const _errs1 = errors;
          if (!(typeof data0 == "number" && (!(data0 % 1) && !isNaN(data0)) && isFinite(data0))) {
            validate41.errors = [{ instancePath: instancePath + "/attempt", schemaPath: "#/properties/attempt/type", keyword: "type", params: { type: "integer" }, message: "must be integer" }];
            return false;
          }
          if (errors === _errs1) {
            if (typeof data0 == "number" && isFinite(data0)) {
              if (data0 > 9007199254740991 || isNaN(data0)) {
                validate41.errors = [{ instancePath: instancePath + "/attempt", schemaPath: "#/properties/attempt/maximum", keyword: "maximum", params: { comparison: "<=", limit: 9007199254740991 }, message: "must be <= 9007199254740991" }];
                return false;
              } else {
                if (data0 < 0 || isNaN(data0)) {
                  validate41.errors = [{ instancePath: instancePath + "/attempt", schemaPath: "#/properties/attempt/minimum", keyword: "minimum", params: { comparison: ">=", limit: 0 }, message: "must be >= 0" }];
                  return false;
                }
              }
            }
          }
          var valid0 = _errs1 === errors;
        } else {
          var valid0 = true;
        }
        if (valid0) {
          if (data.bodyMs !== void 0) {
            let data1 = data.bodyMs;
            const _errs3 = errors;
            if (!(typeof data1 == "number" && (!(data1 % 1) && !isNaN(data1)) && isFinite(data1)) && data1 !== null) {
              validate41.errors = [{ instancePath: instancePath + "/bodyMs", schemaPath: "#/properties/bodyMs/type", keyword: "type", params: { type: schema55.properties.bodyMs.type }, message: "must be integer,null" }];
              return false;
            }
            if (errors === _errs3) {
              if (typeof data1 == "number" && isFinite(data1)) {
                if (data1 > 9007199254740991 || isNaN(data1)) {
                  validate41.errors = [{ instancePath: instancePath + "/bodyMs", schemaPath: "#/properties/bodyMs/maximum", keyword: "maximum", params: { comparison: "<=", limit: 9007199254740991 }, message: "must be <= 9007199254740991" }];
                  return false;
                } else {
                  if (data1 < 0 || isNaN(data1)) {
                    validate41.errors = [{ instancePath: instancePath + "/bodyMs", schemaPath: "#/properties/bodyMs/minimum", keyword: "minimum", params: { comparison: ">=", limit: 0 }, message: "must be >= 0" }];
                    return false;
                  }
                }
              }
            }
            var valid0 = _errs3 === errors;
          } else {
            var valid0 = true;
          }
          if (valid0) {
            if (data.clientReused !== void 0) {
              let data2 = data.clientReused;
              const _errs5 = errors;
              if (typeof data2 !== "boolean" && data2 !== null) {
                validate41.errors = [{ instancePath: instancePath + "/clientReused", schemaPath: "#/properties/clientReused/type", keyword: "type", params: { type: schema55.properties.clientReused.type }, message: "must be boolean,null" }];
                return false;
              }
              var valid0 = _errs5 === errors;
            } else {
              var valid0 = true;
            }
            if (valid0) {
              if (data.contextId !== void 0) {
                let data3 = data.contextId;
                const _errs7 = errors;
                if (typeof data3 !== "string" && data3 !== null) {
                  validate41.errors = [{ instancePath: instancePath + "/contextId", schemaPath: "#/properties/contextId/type", keyword: "type", params: { type: schema55.properties.contextId.type }, message: "must be string,null" }];
                  return false;
                }
                var valid0 = _errs7 === errors;
              } else {
                var valid0 = true;
              }
              if (valid0) {
                if (data.cookieRevision !== void 0) {
                  let data4 = data.cookieRevision;
                  const _errs9 = errors;
                  if (!(typeof data4 == "number" && (!(data4 % 1) && !isNaN(data4)) && isFinite(data4)) && data4 !== null) {
                    validate41.errors = [{ instancePath: instancePath + "/cookieRevision", schemaPath: "#/properties/cookieRevision/type", keyword: "type", params: { type: schema55.properties.cookieRevision.type }, message: "must be integer,null" }];
                    return false;
                  }
                  if (errors === _errs9) {
                    if (typeof data4 == "number" && isFinite(data4)) {
                      if (data4 > 9007199254740991 || isNaN(data4)) {
                        validate41.errors = [{ instancePath: instancePath + "/cookieRevision", schemaPath: "#/properties/cookieRevision/maximum", keyword: "maximum", params: { comparison: "<=", limit: 9007199254740991 }, message: "must be <= 9007199254740991" }];
                        return false;
                      } else {
                        if (data4 < 0 || isNaN(data4)) {
                          validate41.errors = [{ instancePath: instancePath + "/cookieRevision", schemaPath: "#/properties/cookieRevision/minimum", keyword: "minimum", params: { comparison: ">=", limit: 0 }, message: "must be >= 0" }];
                          return false;
                        }
                      }
                    }
                  }
                  var valid0 = _errs9 === errors;
                } else {
                  var valid0 = true;
                }
                if (valid0) {
                  if (data.delivery !== void 0) {
                    let data5 = data.delivery;
                    const _errs11 = errors;
                    if (typeof data5 !== "string") {
                      validate41.errors = [{ instancePath: instancePath + "/delivery", schemaPath: "#/definitions/Delivery/type", keyword: "type", params: { type: "string" }, message: "must be string" }];
                      return false;
                    }
                    if (!(data5 === "not_started" || data5 === "possibly_sent" || data5 === "response_started")) {
                      validate41.errors = [{ instancePath: instancePath + "/delivery", schemaPath: "#/definitions/Delivery/enum", keyword: "enum", params: { allowedValues: schema56.enum }, message: "must be equal to one of the allowed values" }];
                      return false;
                    }
                    var valid0 = _errs11 === errors;
                  } else {
                    var valid0 = true;
                  }
                  if (valid0) {
                    if (data.headersMs !== void 0) {
                      let data6 = data.headersMs;
                      const _errs14 = errors;
                      if (!(typeof data6 == "number" && (!(data6 % 1) && !isNaN(data6)) && isFinite(data6)) && data6 !== null) {
                        validate41.errors = [{ instancePath: instancePath + "/headersMs", schemaPath: "#/properties/headersMs/type", keyword: "type", params: { type: schema55.properties.headersMs.type }, message: "must be integer,null" }];
                        return false;
                      }
                      if (errors === _errs14) {
                        if (typeof data6 == "number" && isFinite(data6)) {
                          if (data6 > 9007199254740991 || isNaN(data6)) {
                            validate41.errors = [{ instancePath: instancePath + "/headersMs", schemaPath: "#/properties/headersMs/maximum", keyword: "maximum", params: { comparison: "<=", limit: 9007199254740991 }, message: "must be <= 9007199254740991" }];
                            return false;
                          } else {
                            if (data6 < 0 || isNaN(data6)) {
                              validate41.errors = [{ instancePath: instancePath + "/headersMs", schemaPath: "#/properties/headersMs/minimum", keyword: "minimum", params: { comparison: ">=", limit: 0 }, message: "must be >= 0" }];
                              return false;
                            }
                          }
                        }
                      }
                      var valid0 = _errs14 === errors;
                    } else {
                      var valid0 = true;
                    }
                    if (valid0) {
                      if (data.phase !== void 0) {
                        let data7 = data.phase;
                        const _errs16 = errors;
                        if (typeof data7 !== "string") {
                          validate41.errors = [{ instancePath: instancePath + "/phase", schemaPath: "#/definitions/Phase/type", keyword: "type", params: { type: "string" }, message: "must be string" }];
                          return false;
                        }
                        if (!(data7 === "queued" || data7 === "preparing" || data7 === "upstream" || data7 === "body" || data7 === "complete")) {
                          validate41.errors = [{ instancePath: instancePath + "/phase", schemaPath: "#/definitions/Phase/enum", keyword: "enum", params: { allowedValues: schema57.enum }, message: "must be equal to one of the allowed values" }];
                          return false;
                        }
                        var valid0 = _errs16 === errors;
                      } else {
                        var valid0 = true;
                      }
                      if (valid0) {
                        if (data.queueMs !== void 0) {
                          let data8 = data.queueMs;
                          const _errs19 = errors;
                          if (!(typeof data8 == "number" && (!(data8 % 1) && !isNaN(data8)) && isFinite(data8))) {
                            validate41.errors = [{ instancePath: instancePath + "/queueMs", schemaPath: "#/properties/queueMs/type", keyword: "type", params: { type: "integer" }, message: "must be integer" }];
                            return false;
                          }
                          if (errors === _errs19) {
                            if (typeof data8 == "number" && isFinite(data8)) {
                              if (data8 > 9007199254740991 || isNaN(data8)) {
                                validate41.errors = [{ instancePath: instancePath + "/queueMs", schemaPath: "#/properties/queueMs/maximum", keyword: "maximum", params: { comparison: "<=", limit: 9007199254740991 }, message: "must be <= 9007199254740991" }];
                                return false;
                              } else {
                                if (data8 < 0 || isNaN(data8)) {
                                  validate41.errors = [{ instancePath: instancePath + "/queueMs", schemaPath: "#/properties/queueMs/minimum", keyword: "minimum", params: { comparison: ">=", limit: 0 }, message: "must be >= 0" }];
                                  return false;
                                }
                              }
                            }
                          }
                          var valid0 = _errs19 === errors;
                        } else {
                          var valid0 = true;
                        }
                        if (valid0) {
                          if (data.requestBytes !== void 0) {
                            let data9 = data.requestBytes;
                            const _errs21 = errors;
                            if (!(typeof data9 == "number" && (!(data9 % 1) && !isNaN(data9)) && isFinite(data9))) {
                              validate41.errors = [{ instancePath: instancePath + "/requestBytes", schemaPath: "#/properties/requestBytes/type", keyword: "type", params: { type: "integer" }, message: "must be integer" }];
                              return false;
                            }
                            if (errors === _errs21) {
                              if (typeof data9 == "number" && isFinite(data9)) {
                                if (data9 > 9007199254740991 || isNaN(data9)) {
                                  validate41.errors = [{ instancePath: instancePath + "/requestBytes", schemaPath: "#/properties/requestBytes/maximum", keyword: "maximum", params: { comparison: "<=", limit: 9007199254740991 }, message: "must be <= 9007199254740991" }];
                                  return false;
                                } else {
                                  if (data9 < 0 || isNaN(data9)) {
                                    validate41.errors = [{ instancePath: instancePath + "/requestBytes", schemaPath: "#/properties/requestBytes/minimum", keyword: "minimum", params: { comparison: ">=", limit: 0 }, message: "must be >= 0" }];
                                    return false;
                                  }
                                }
                              }
                            }
                            var valid0 = _errs21 === errors;
                          } else {
                            var valid0 = true;
                          }
                          if (valid0) {
                            if (data.requestId !== void 0) {
                              const _errs23 = errors;
                              if (typeof data.requestId !== "string") {
                                validate41.errors = [{ instancePath: instancePath + "/requestId", schemaPath: "#/properties/requestId/type", keyword: "type", params: { type: "string" }, message: "must be string" }];
                                return false;
                              }
                              var valid0 = _errs23 === errors;
                            } else {
                              var valid0 = true;
                            }
                            if (valid0) {
                              if (data.responseBytes !== void 0) {
                                let data11 = data.responseBytes;
                                const _errs25 = errors;
                                if (!(typeof data11 == "number" && (!(data11 % 1) && !isNaN(data11)) && isFinite(data11))) {
                                  validate41.errors = [{ instancePath: instancePath + "/responseBytes", schemaPath: "#/properties/responseBytes/type", keyword: "type", params: { type: "integer" }, message: "must be integer" }];
                                  return false;
                                }
                                if (errors === _errs25) {
                                  if (typeof data11 == "number" && isFinite(data11)) {
                                    if (data11 > 9007199254740991 || isNaN(data11)) {
                                      validate41.errors = [{ instancePath: instancePath + "/responseBytes", schemaPath: "#/properties/responseBytes/maximum", keyword: "maximum", params: { comparison: "<=", limit: 9007199254740991 }, message: "must be <= 9007199254740991" }];
                                      return false;
                                    } else {
                                      if (data11 < 0 || isNaN(data11)) {
                                        validate41.errors = [{ instancePath: instancePath + "/responseBytes", schemaPath: "#/properties/responseBytes/minimum", keyword: "minimum", params: { comparison: ">=", limit: 0 }, message: "must be >= 0" }];
                                        return false;
                                      }
                                    }
                                  }
                                }
                                var valid0 = _errs25 === errors;
                              } else {
                                var valid0 = true;
                              }
                              if (valid0) {
                                if (data.tlsProfile !== void 0) {
                                  const _errs27 = errors;
                                  if (typeof data.tlsProfile !== "string") {
                                    validate41.errors = [{ instancePath: instancePath + "/tlsProfile", schemaPath: "#/properties/tlsProfile/type", keyword: "type", params: { type: "string" }, message: "must be string" }];
                                    return false;
                                  }
                                  var valid0 = _errs27 === errors;
                                } else {
                                  var valid0 = true;
                                }
                                if (valid0) {
                                  if (data.totalMs !== void 0) {
                                    let data13 = data.totalMs;
                                    const _errs29 = errors;
                                    if (!(typeof data13 == "number" && (!(data13 % 1) && !isNaN(data13)) && isFinite(data13))) {
                                      validate41.errors = [{ instancePath: instancePath + "/totalMs", schemaPath: "#/properties/totalMs/type", keyword: "type", params: { type: "integer" }, message: "must be integer" }];
                                      return false;
                                    }
                                    if (errors === _errs29) {
                                      if (typeof data13 == "number" && isFinite(data13)) {
                                        if (data13 > 9007199254740991 || isNaN(data13)) {
                                          validate41.errors = [{ instancePath: instancePath + "/totalMs", schemaPath: "#/properties/totalMs/maximum", keyword: "maximum", params: { comparison: "<=", limit: 9007199254740991 }, message: "must be <= 9007199254740991" }];
                                          return false;
                                        } else {
                                          if (data13 < 0 || isNaN(data13)) {
                                            validate41.errors = [{ instancePath: instancePath + "/totalMs", schemaPath: "#/properties/totalMs/minimum", keyword: "minimum", params: { comparison: ">=", limit: 0 }, message: "must be >= 0" }];
                                            return false;
                                          }
                                        }
                                      }
                                    }
                                    var valid0 = _errs29 === errors;
                                  } else {
                                    var valid0 = true;
                                  }
                                  if (valid0) {
                                    if (data.traceId !== void 0) {
                                      let data14 = data.traceId;
                                      const _errs31 = errors;
                                      if (typeof data14 !== "string" && data14 !== null) {
                                        validate41.errors = [{ instancePath: instancePath + "/traceId", schemaPath: "#/properties/traceId/type", keyword: "type", params: { type: schema55.properties.traceId.type }, message: "must be string,null" }];
                                        return false;
                                      }
                                      var valid0 = _errs31 === errors;
                                    } else {
                                      var valid0 = true;
                                    }
                                  }
                                }
                              }
                            }
                          }
                        }
                      }
                    }
                  }
                }
              }
            }
          }
        }
      }
    } else {
      validate41.errors = [{ instancePath, schemaPath: "#/type", keyword: "type", params: { type: "object" }, message: "must be object" }];
      return false;
    }
  }
  validate41.errors = vErrors;
  return errors === 0;
}
var schema59 = { "enum": ["UNAUTHORIZED", "INVALID_REQUEST", "UNSUPPORTED_CAPABILITY", "INVALID_PROFILE", "EGRESS_REQUIRED", "SSRF_BLOCKED", "BODY_TOO_LARGE", "BUSY", "TIMEOUT", "CANCELLED", "DNS_ERROR", "PROXY_ERROR", "TLS_ERROR", "CONNECT_ERROR", "PROTOCOL_ERROR", "CONTEXT_NOT_FOUND", "CONTEXT_CONFLICT", "CONTEXT_LIMIT", "COOKIE_LIMIT", "DUPLICATE_REQUEST", "UNKNOWN"], "type": "string" };
function validate43(data, { instancePath = "", parentData, parentDataProperty, rootData = data } = {}) {
  let vErrors = null;
  let errors = 0;
  if (errors === 0) {
    if (data && typeof data == "object" && !Array.isArray(data)) {
      let missing0;
      if (data.code === void 0 && (missing0 = "code") || data.message === void 0 && (missing0 = "message")) {
        validate43.errors = [{ instancePath, schemaPath: "#/required", keyword: "required", params: { missingProperty: missing0 }, message: "must have required property '" + missing0 + "'" }];
        return false;
      } else {
        if (data.code !== void 0) {
          let data0 = data.code;
          const _errs1 = errors;
          if (typeof data0 !== "string") {
            validate43.errors = [{ instancePath: instancePath + "/code", schemaPath: "#/definitions/ErrorCode/type", keyword: "type", params: { type: "string" }, message: "must be string" }];
            return false;
          }
          if (!(data0 === "UNAUTHORIZED" || data0 === "INVALID_REQUEST" || data0 === "UNSUPPORTED_CAPABILITY" || data0 === "INVALID_PROFILE" || data0 === "EGRESS_REQUIRED" || data0 === "SSRF_BLOCKED" || data0 === "BODY_TOO_LARGE" || data0 === "BUSY" || data0 === "TIMEOUT" || data0 === "CANCELLED" || data0 === "DNS_ERROR" || data0 === "PROXY_ERROR" || data0 === "TLS_ERROR" || data0 === "CONNECT_ERROR" || data0 === "PROTOCOL_ERROR" || data0 === "CONTEXT_NOT_FOUND" || data0 === "CONTEXT_CONFLICT" || data0 === "CONTEXT_LIMIT" || data0 === "COOKIE_LIMIT" || data0 === "DUPLICATE_REQUEST" || data0 === "UNKNOWN")) {
            validate43.errors = [{ instancePath: instancePath + "/code", schemaPath: "#/definitions/ErrorCode/enum", keyword: "enum", params: { allowedValues: schema59.enum }, message: "must be equal to one of the allowed values" }];
            return false;
          }
          var valid0 = _errs1 === errors;
        } else {
          var valid0 = true;
        }
        if (valid0) {
          if (data.diagnostics !== void 0) {
            let data1 = data.diagnostics;
            const _errs4 = errors;
            const _errs5 = errors;
            let valid2 = false;
            const _errs6 = errors;
            if (!validate41(data1, { instancePath: instancePath + "/diagnostics", parentData: data, parentDataProperty: "diagnostics", rootData })) {
              vErrors = vErrors === null ? validate41.errors : vErrors.concat(validate41.errors);
              errors = vErrors.length;
            }
            var _valid0 = _errs6 === errors;
            valid2 = valid2 || _valid0;
            if (!valid2) {
              const _errs7 = errors;
              if (data1 !== null) {
                const err0 = { instancePath: instancePath + "/diagnostics", schemaPath: "#/properties/diagnostics/anyOf/1/type", keyword: "type", params: { type: "null" }, message: "must be null" };
                if (vErrors === null) {
                  vErrors = [err0];
                } else {
                  vErrors.push(err0);
                }
                errors++;
              }
              var _valid0 = _errs7 === errors;
              valid2 = valid2 || _valid0;
            }
            if (!valid2) {
              const err1 = { instancePath: instancePath + "/diagnostics", schemaPath: "#/properties/diagnostics/anyOf", keyword: "anyOf", params: {}, message: "must match a schema in anyOf" };
              if (vErrors === null) {
                vErrors = [err1];
              } else {
                vErrors.push(err1);
              }
              errors++;
              validate43.errors = vErrors;
              return false;
            } else {
              errors = _errs5;
              if (vErrors !== null) {
                if (_errs5) {
                  vErrors.length = _errs5;
                } else {
                  vErrors = null;
                }
              }
            }
            var valid0 = _errs4 === errors;
          } else {
            var valid0 = true;
          }
          if (valid0) {
            if (data.message !== void 0) {
              const _errs9 = errors;
              if (typeof data.message !== "string") {
                validate43.errors = [{ instancePath: instancePath + "/message", schemaPath: "#/properties/message/type", keyword: "type", params: { type: "string" }, message: "must be string" }];
                return false;
              }
              var valid0 = _errs9 === errors;
            } else {
              var valid0 = true;
            }
          }
        }
      }
    } else {
      validate43.errors = [{ instancePath, schemaPath: "#/type", keyword: "type", params: { type: "object" }, message: "must be object" }];
      return false;
    }
  }
  validate43.errors = vErrors;
  return errors === 0;
}
function validate40(data, { instancePath = "", parentData, parentDataProperty, rootData = data } = {}) {
  ;
  let vErrors = null;
  let errors = 0;
  if (errors === 0) {
    if (data && typeof data == "object" && !Array.isArray(data)) {
      let missing0;
      if (data.state === void 0 && (missing0 = "state") || data.diagnostics === void 0 && (missing0 = "diagnostics")) {
        validate40.errors = [{ instancePath, schemaPath: "#/required", keyword: "required", params: { missingProperty: missing0 }, message: "must have required property '" + missing0 + "'" }];
        return false;
      } else {
        if (data.diagnostics !== void 0) {
          const _errs1 = errors;
          if (!validate41(data.diagnostics, { instancePath: instancePath + "/diagnostics", parentData: data, parentDataProperty: "diagnostics", rootData })) {
            vErrors = vErrors === null ? validate41.errors : vErrors.concat(validate41.errors);
            errors = vErrors.length;
          }
          var valid0 = _errs1 === errors;
        } else {
          var valid0 = true;
        }
        if (valid0) {
          if (data.error !== void 0) {
            let data1 = data.error;
            const _errs2 = errors;
            const _errs3 = errors;
            let valid1 = false;
            const _errs4 = errors;
            if (!validate43(data1, { instancePath: instancePath + "/error", parentData: data, parentDataProperty: "error", rootData })) {
              vErrors = vErrors === null ? validate43.errors : vErrors.concat(validate43.errors);
              errors = vErrors.length;
            }
            var _valid0 = _errs4 === errors;
            valid1 = valid1 || _valid0;
            if (!valid1) {
              const _errs5 = errors;
              if (data1 !== null) {
                const err0 = { instancePath: instancePath + "/error", schemaPath: "#/properties/error/anyOf/1/type", keyword: "type", params: { type: "null" }, message: "must be null" };
                if (vErrors === null) {
                  vErrors = [err0];
                } else {
                  vErrors.push(err0);
                }
                errors++;
              }
              var _valid0 = _errs5 === errors;
              valid1 = valid1 || _valid0;
            }
            if (!valid1) {
              const err1 = { instancePath: instancePath + "/error", schemaPath: "#/properties/error/anyOf", keyword: "anyOf", params: {}, message: "must match a schema in anyOf" };
              if (vErrors === null) {
                vErrors = [err1];
              } else {
                vErrors.push(err1);
              }
              errors++;
              validate40.errors = vErrors;
              return false;
            } else {
              errors = _errs3;
              if (vErrors !== null) {
                if (_errs3) {
                  vErrors.length = _errs3;
                } else {
                  vErrors = null;
                }
              }
            }
            var valid0 = _errs2 === errors;
          } else {
            var valid0 = true;
          }
          if (valid0) {
            if (data.state !== void 0) {
              let data2 = data.state;
              const _errs7 = errors;
              if (typeof data2 !== "string") {
                validate40.errors = [{ instancePath: instancePath + "/state", schemaPath: "#/definitions/RequestState/type", keyword: "type", params: { type: "string" }, message: "must be string" }];
                return false;
              }
              if (!(data2 === "queued" || data2 === "active" || data2 === "complete" || data2 === "failed")) {
                validate40.errors = [{ instancePath: instancePath + "/state", schemaPath: "#/definitions/RequestState/enum", keyword: "enum", params: { allowedValues: schema60.enum }, message: "must be equal to one of the allowed values" }];
                return false;
              }
              var valid0 = _errs7 === errors;
            } else {
              var valid0 = true;
            }
          }
        }
      }
    } else {
      validate40.errors = [{ instancePath, schemaPath: "#/type", keyword: "type", params: { type: "object" }, message: "must be object" }];
      return false;
    }
  }
  validate40.errors = vErrors;
  return errors === 0;
}
export {
  capabilities,
  contextInfo,
  cookieOperation,
  cookieRecord,
  cookieReply,
  cookieSnapshot,
  createContext,
  diagnostics,
  requestMetadata,
  requestStatus,
  responseMetadata,
  transportError
};
