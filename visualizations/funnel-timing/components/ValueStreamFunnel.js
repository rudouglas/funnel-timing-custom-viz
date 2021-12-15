import React from "react";
import {
  Stack,
  StackItem,
  Grid,
  GridItem,
  NrqlQuery,
  Spinner,
  Card,
  CardHeader,
} from "nr1";

const optionalClauses = [
  "AS",
  "COMPARE",
  "EXTRAPOLATE",
  "FACET",
  "LIMIT",
  "OFFSET",
  "ORDER",
  "SHOW",
  "SINCE",
  "SLIDE",
  "TIMESERIES",
  "UNTIL",
  "WHERE",
  "WITH",
];

export default class ValueStreamFunnel extends React.Component {
  constructor(props) {
    super(props);

    this.state = {
      results: null,
      funnelAttributeAs: null,
    };
    this.parseQuery = this.parseQuery.bind(this);
  }
  async queryAvgMax(query, accountId) {
    return await NrqlQuery.query({
      query,
      accountId,
    }).then((res) => {
      if (res.data.errors) {
        throw new Error(res.data.errors);
      }

      if (res.data.length !== 2) {
        throw new Error("Expected 2 rows of data");
      }
      const { data } = res;
      const average = data.find((row) => row.data[0].average).data[0].average;
      const max = data.find((row) => row.data[0].max).data[0].max;

      return { average, max };
    });
  }

  async queryMinData(query, accountId) {
    return await NrqlQuery.query({
      query,
      accountId,
    }).then((res) => {

      if (res.data.errors) {
        throw new Error(res.data.errors);
      }

      if (res.data.length !== 1) {
        throw new Error("Expected 1 rows of data");
      }
      const { min } = res.data[0].data[0];
      return { min };
    });
  }

  calculateTimeUnit(value) {
    const milliseconds = (value / 1000).toFixed(2);
    let seconds = (value / 1000000).toFixed(2);
    let minutes = (value / (1000000 * 60)).toFixed(1);
    let hours = (value / (1000000 * 60 * 60)).toFixed(1);
    let days = (value / (1000000 * 60 * 60 * 24)).toFixed(1);
    if (value < 1000) return `${value} µs`;
    else if (milliseconds < 1000) return `${milliseconds} ms`;
    else if (seconds < 60) return seconds + " s";
    else if (minutes < 60) return minutes + " min";
    else if (hours < 24) return hours + " hrs";
    else return days + " days";
  }

  parseQuery = async (query, accountId) => {
    const calculateSince = (string) => {
      const upto = optionalClauses.join("|");
      const regexSince = new RegExp(`since(.*?)(?=${upto}|$)`, "i");
      return string.match(regexSince)[0];
    };

    console.log({ query });
    const funnel = query.match(/\((?:[^)(]+|\((?:[^)(]+|\([^)(]*\))*\))*\)/g);
    const from = query.match(/(?<=from\s)(.*?)(?=\s)/i)[0];
    const since = calculateSince(query.match(/since.*/i)[0]);
    const splitted = funnel[0].slice(1, -1).split(",");
    const funnelFocus = splitted.shift();
    const funnelAttribute = funnelFocus.split(" ")[0];
    const funnelAttributeAsMatch = funnelFocus.match(/(?<=as\s\')(.*?)(?=\')/i);
    const funnelAttributeAs = funnelAttributeAsMatch ? funnelAttributeAsMatch[0] : funnelAttribute;

    const steps = splitted.map((split, index) => {
      const where = split.match(/(?<=where)(.*?)(?=AND|OR|AS|$)/i)[0].trim();
      const fullWhere = split.match(/where(.*?)(?=AS|$)/i)[0].trim();
      const asClause = split.match(/(?<=as)(.*?)(?=$)/i)[0].trim();
      return { where, fullWhere, split, index, asClause };
    });
    const results = await Promise.all(
      steps.map(async ({ where, fullWhere, asClause }, index) => {
        if (steps[index + 1]) {
          const endWhere = steps[index + 1].where;
          const avgMaxQuery = `SELECT average((ended - started)) as 'average', max((ended - started)) as 'max' FROM (SELECT min(timestamp) as started, max(timestamp) as ended FROM ${from} ${fullWhere} WHERE ${where} or ${endWhere} FACET ${funnelAttribute} limit MAX) ${since} limit MAX`;
          const avgMaxResult = await this.queryAvgMax(avgMaxQuery, accountId);
          const minQuery = `SELECT min((ended - started)) as 'min' FROM (SELECT min(timestamp) as started, max(timestamp) as ended FROM ${from} ${fullWhere} WHERE ${where} or ${endWhere} FACET ${funnelAttribute} limit MAX) WHERE ended - started != 0 ${since} limit MAX`;
          const minResult = await this.queryMinData(minQuery, accountId);

          const data = [
            {
              id: "min",
              name: "Min",
              value: this.calculateTimeUnit(minResult.min),
            },
            {
              id: "avg",
              name: "Average",
              value: this.calculateTimeUnit(avgMaxResult.average),
            },
            {
              id: "max",
              name: "Max",
              value: this.calculateTimeUnit(avgMaxResult.max),
            },
          ];
          return {
            data,
            index,
            startStep: asClause.replaceAll(`'`, ``),
            endStep: steps[index + 1].asClause.replaceAll(`'`, ``),
          };
        }
        return;
      })
    ).then(function (data) {
      return data.filter(Boolean);
    });
    this.setState({ results, funnelAttributeAs });

    return results;
  };

  componentDidMount() {
    const { query, accountId } = this.props;
    this.parseQuery(query, accountId);
  }

  render() {
    const { results, funnelAttributeAs } = this.state;
    const { funnelResults, fill } = this.props;

    return funnelResults && results ? (
      funnelResults.map((result, index) => {
        const calculatedData = results.find(
          (res) => res.startStep === result.step
        )?.data;
        return (
          <>
            <Grid
              style={{
                border: `2px solid #e6e6e6`,
                margin: "5px",
                borderRadius: "5px",
              }}
              preview
            >
              <GridItem columnSpan={2}>
                <Card
                  style={{
                    display: "flex",
                    justifyContent: "center",
                    alignItems: "center",
                    height: "100%",
                    fontSize: "1.3rem",
                  }}
                >{`${result.percentage}%`}</Card>
              </GridItem>
              <GridItem columnSpan={7}>
                <Card
                  style={{
                    display: "flex",
                    justifyContent: "center",
                    height: "1.2rem",
                    border: `2px dashed ${fill || "#D291BC"}`,
                  }}
                >
                  <Card
                    style={{
                      backgroundColor: `${fill || "#D291BC"}`,
                      width: `${result.percentage}%`,
                      display: "flex",
                      justifyContent: "center",
                    }}
                  />
                </Card>
                {index !== funnelResults.length - 1 && (
                  <Stack
                    directionType={Stack.DIRECTION_TYPE.Horizontal}
                    horizontalType={Stack.HORIZONTAL_TYPE.CENTER}
                    style={{ fontSize: "0.7rem", margin: "5px" }}
                    gapType={Stack.GAP_TYPE.EXTRA_LARGE}
                    fullWidth
                  >
                    {calculatedData &&
                      calculatedData.map((data) => (
                        <StackItem>
                          <p>{data.id.toUpperCase()}</p>
                          <p style={{ fontSize: "1rem" }}>
                            <strong>{data.value}</strong>
                          </p>
                        </StackItem>
                      ))}
                  </Stack>
                )}
              </GridItem>
              <GridItem columnSpan={3}>
                <Card
                  style={{
                    display: "flex",
                    justifyContent: "center",
                    alignItems: "left",
                    height: "100%",
                    fontSize: "1.1em",
                  }}
                >
                  <CardHeader title={result.step} subtitle={`${result.value} ${funnelAttributeAs}s`} />
                  
                </Card>
              </GridItem>
            </Grid>
          </>
        );
      })
    ) : (
      <Spinner />
    );
  }
}
