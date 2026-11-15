/**
 * Instància compartida de Highcharts amb els mòduls que fa servir el portal.
 *
 * A partir de la v12 els mòduls s'autoregistren en importar-los; només cal
 * fer-ho un cop i des d'un mòdul de client, perquè tots els gràfics comparteixin
 * la mateixa instància.
 */
import Highcharts from "highcharts";
import "highcharts/highcharts-more";
import "highcharts/modules/map";

export default Highcharts;
