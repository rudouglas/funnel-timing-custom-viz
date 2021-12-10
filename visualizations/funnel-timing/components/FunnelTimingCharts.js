import React from "react";
import {
  Stack,
  StackItem,
  HeadingText,
  Grid,
  GridItem,
  NrqlQuery,
  Spinner,
  BillboardChart,
  Icon,
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

export default class FunnelTimingCharts extends React.Component {
  constructor(props) {
    super(props);

    this.state = {
      results: null,
    };
    this.parseQuery = this.parseQuery.bind(this);
  }
  async queryAvgMax(query, accountId) {
    return await NrqlQuery.query({
      query,
      accountId,
    }).then((res) => {
      //   console.log({ res });
      if (res.data.errors) {
        throw new Error(res.data.errors);
      }

      if (res.data.length !== 2) {
        throw new Error("Expected 2 rows of data");
      }
      const { data } = res;
      const average = data.find((row) => row.data[0].average).data[0].average;
      const max = data.find((row) => row.data[0].max).data[0].max;
      //   console.log({ average, max });
      return { average, max };
    });
  }
  async queryMinData(query, accountId) {
    return await NrqlQuery.query({
      query,
      accountId,
    }).then((res) => {
      //   console.log({ res });
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
  /**
   * Restructure the data for a non-time-series, facet-based NRQL query into a
   * form accepted by the Recharts library's RadarChart.
   * (https://recharts.org/api/RadarChart).
   */
  parseQuery = async (query, accountId) => {
    const calculateSince = (string) => {
      const upto = optionalClauses.join("|");
      const regexSince = new RegExp(`since(.*?)(?=${upto}|$)`, "i");
      return string.match(regexSince)[0];
    };

    console.log({ query });
    const funnel = query.match(/\((?:[^)(]+|\((?:[^)(]+|\([^)(]*\))*\))*\)/g);
    const from = query.match(/(?<=from\s)(.*?)(?=\s)/i)[0];
    const select = query.match(/(?<=select\s)(.*?)(?=\s)/i)[0];
    const since = calculateSince(query.match(/since.*/i)[0]);
    console.log({ since });
    // console.log({funnel})
    const splitted = funnel[0].slice(1, -1).split(",");
    const attribute = splitted.shift().split(" ")[0];
    console.log({ attribute });

    const steps = splitted.map((split, index) => {
      const where = split.match(/(?<=where)(.*?)(?=AND|OR|AS|$)/i)[0].trim();
      const fullWhere = split.match(/where(.*?)(?=AS|$)/i)[0].trim();
      const asClause = split.match(/(?<=as)(.*?)(?=$)/i)[0].trim();
      // console.log({ where, fullWhere, split });
      return { where, fullWhere, split, index, asClause };
    });
    console.log({ steps });
    const results = await Promise.all(
      steps.map(async ({ where, fullWhere, split, asClause }, index) => {
        if (steps[index + 1]) {
          const endWhere = steps[index + 1].where;
          const avgMaxQuery = `SELECT average((ended - started)) as 'average', max((ended - started)) as 'max' FROM (SELECT min(timestamp) as started, max(timestamp) as ended FROM ${from} ${fullWhere} WHERE ${where} or ${endWhere} FACET ${attribute} limit MAX) ${since} limit MAX`;
          console.log(`${index} query`);
          const avgMaxResult = await this.queryAvgMax(avgMaxQuery, accountId);
          // console.log({ avgMaxResult });
          const minQuery = `SELECT min((ended - started)) as 'min' FROM (SELECT min(timestamp) as started, max(timestamp) as ended FROM ${from} ${fullWhere} WHERE ${where} or ${endWhere} FACET ${attribute} limit MAX) WHERE ended - started != 0 ${since} limit MAX`;
          const minResult = await this.queryMinData(minQuery, accountId);
          // console.log({ ...minResult, ...avgMaxResult, index, asClause });
          const data = [
            {
              metadata: {
                id: "min",
                name: "Min",
                color: "#f6f6f6",
                viz: "main",
                units_data: {
                  y: "MS",
                },
              },
              data: [{ y: minResult.min / 1000 }],
            },
            {
              metadata: {
                id: "avg",
                name: "Average",
                color: "#eaeaea",
                viz: "main",
                units_data: {
                  y: "MS",
                },
              },
              data: [{ y: avgMaxResult.average / 1000 }],
            },
            {
              metadata: {
                id: "max",
                name: "Max",
                color: "#e6e6e6",
                viz: "main",
                units_data: {
                  y: "MS",
                },
              },
              data: [{ y: avgMaxResult.max / 1000 }],
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
      console.log({ data });
      return data.filter(Boolean);
    });
    console.log({ results });
    this.setState({ results });
    return results;
  };

  componentDidMount() {
    const { query, accountId } = this.props;
    this.parseQuery(query, accountId);
  }
  render() {
    const { results } = this.state;
    return results ? (
      results.map((result, index) => (
        <>
          <Grid
            style={{
              border: "2px solid #e6e6e6",
              margin: "5px",
              borderRadius: "5px",
            }}
          >
            <GridItem columnSpan={3}>
              <Stack
                directionType={Stack.DIRECTION_TYPE.VERTICAL}
                gapType={Stack.GAP_TYPE.NONE}
                horizontalType={Stack.HORIZONTAL_TYPE.CENTER}
                verticalType={Stack.VERTICAL_TYPE.CENTER}
                style={{ height: "100%" }}
                fullWidth
              >
                <StackItem>
                  <HeadingText
                    type={HeadingText.TYPE.HEADING_2}
                    spacingType={[
                      HeadingText.SPACING_TYPE.EXTRA_LARGE,
                      HeadingText.SPACING_TYPE.SMALL,
                    ]}
                  >
                    {result.startStep}
                  </HeadingText>
                </StackItem>
                <StackItem style={{ height: "100%", paddingTop: "2rem" }} grow>
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    height="50%"
                    style={{minHeight: "44px"}}
                    viewBox="0 0 64 64"
                    enable-background="new 0 0 64 64"
                  >
                    <circle cx="32" cy="32" r="30" fill="#fff" />
                    <path
                      d="m53.213 10.786c-11.715-11.715-30.711-11.715-42.426 0-11.716 11.715-11.716 30.711 0 42.426 11.715 11.717 30.711 11.717 42.426 0 11.716-11.715 11.716-30.711 0-42.426m-16.392 43.213l-8.179-8.912h4.596v-22.203c0-3.045-2.41-5.521-5.373-5.521-1.434 0-2.785.574-3.8 1.617l-5.065-5.209c2.368-2.432 5.517-3.771 8.865-3.771 6.914 0 12.537 5.779 12.537 12.885v22.203h4.598l-8.179 8.911"
                      fill="#546e7a"
                    />
                  </svg>
                </StackItem>

                {index === results.length - 1 && (
                  <StackItem>
                    <HeadingText
                      type={HeadingText.TYPE.HEADING_2}
                      spacingType={[
                        HeadingText.SPACING_TYPE.EXTRA_LARGE,
                        HeadingText.SPACING_TYPE.SMALL,
                      ]}
                    >
                      {result.endStep}
                    </HeadingText>
                  </StackItem>
                )}
              </Stack>
            </GridItem>
            <GridItem columnSpan={9}>
              <BillboardChart data={result.data} fullWidth />
            </GridItem>
          </Grid>
        </>
      ))
    ) : (
      <Spinner />
    );
  }
}
