import React from "react";
import PropTypes from "prop-types";

import {
  Card,
  CardBody,
  HeadingText,
  NrqlQuery,
  Spinner,
  AutoSizer,
} from "nr1";
import ValueStreamFunnel from "./components/ValueStreamFunnel";
export default class FunnelTimingVisualization extends React.Component {
  // Custom props you wish to be configurable in the UI must also be defined in
  // the nr1.json file for the visualization. See docs for more details.
  static propTypes = {
    /**
     * A fill color to override the default fill color. This is an example of
     * a custom chart configuration.
     */
    fill: PropTypes.string,

    /**
     * An array of objects consisting of a nrql `query` and `accountId`.
     * This should be a standard prop for any NRQL based visualizations.
     */
    nrqlQueries: PropTypes.arrayOf(
      PropTypes.shape({
        accountId: PropTypes.number,
        query: PropTypes.string,
      })
    ),
  };

  render() {
    const { nrqlQueries, fill } = this.props;
    const nrqlQueryPropsAvailable =
      nrqlQueries &&
      nrqlQueries[0] &&
      nrqlQueries[0].accountId &&
      nrqlQueries[0].query;
    if (!nrqlQueryPropsAvailable) {
      return <EmptyState />;
    }
    const { query, accountId } = nrqlQueries[0];
    return (
      <AutoSizer>
        {({ width, height }) => (
          <NrqlQuery
            query={nrqlQueries[0].query}
            accountId={parseInt(nrqlQueries[0].accountId)}
            pollInterval={NrqlQuery.AUTO_POLL_INTERVAL}
          >
            {({ data, loading, error }) => {
              if (loading) {
                return <Spinner />;
              }

              if (error) {
                return <ErrorState />;
              }
              const resultData = Object.entries(data[0].data[0]).sort(
                (a, b) => b[1] - a[1]
              );
              const percentageData = resultData
                .map(([step, value]) => {
                  return {
                    step,
                    value,
                    percentage:
                      Math.round(
                        ((value / resultData[0][1]) * 100 + Number.EPSILON) *
                          100
                      ) / 100,
                  };
                })
                .filter(({ step }) => !["x", "y"].includes(step));

              return (
                <ValueStreamFunnel
                  funnelResults={percentageData}
                  query={query}
                  accountId={accountId}
                  fill={fill}
                />
              );
            }}
          </NrqlQuery>
        )}
      </AutoSizer>
    );
  }
}

const EmptyState = () => (
  <Card className="EmptyState">
    <CardBody className="EmptyState-cardBody">
      <HeadingText
        spacingType={[HeadingText.SPACING_TYPE.LARGE]}
        type={HeadingText.TYPE.HEADING_3}
      >
        Please provide at least one NRQL query & account ID pair
      </HeadingText>
      <HeadingText
        spacingType={[HeadingText.SPACING_TYPE.MEDIUM]}
        type={HeadingText.TYPE.HEADING_4}
      >
        An example NRQL query you can try is:
      </HeadingText>
      <code>
        FROM TessenAction SELECT funnel(anonymousId as 'Unique user', WHERE
        eventName = 'TDEV_DocPageView_pageView' and path =
        '/instant-observability/' and customer_user_id IS NULL as 'View I/O
        Home', WHERE eventName = 'TDEV_QuickstartClick_instantObservability' as
        'View details', WHERE eventName =
        'TDEV_QuickstartInstall_instantObservability' as 'Click install', WHERE
        eventName = 'TLMK_SignUp_signup' AS 'Signup form', WHERE eventName =
        'TLMK_SignUp_signupThankYou' AS 'Signup success') SINCE 4 weeks ago
        LIMIT MAX
      </code>
    </CardBody>
  </Card>
);

const ErrorState = () => (
  <Card className="ErrorState">
    <CardBody className="ErrorState-cardBody">
      <HeadingText
        className="ErrorState-headingText"
        spacingType={[HeadingText.SPACING_TYPE.LARGE]}
        type={HeadingText.TYPE.HEADING_3}
      >
        Oops! Something went wrong.
      </HeadingText>
    </CardBody>
  </Card>
);
