import csvToJson from "convert-csv-to-json";

class UtilityService {
  convertCSVToJSON(filePath) {
    const json = csvToJson.fieldDelimiter(",").getJsonFromCsv(filePath);
    return json;
  }
}

export default UtilityService;
