import React from "react";
import PropTypes from "prop-types";

import {
  Card,
  CardBody,
  HeadingText,
  NrqlQuery,
  Spinner,
  AutoSizer,
  StackedBarChart
} from "nr1";
import FunnelTimingCharts from './components/FunnelTimingCharts';

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
     * A stroke color to override the default stroke color. This is an example of
     * a custom chart configuration.
     */
    stroke: PropTypes.string,
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
  

  /**
   * Format the given axis tick's numeric value into a string for display.
   */
  formatTick = (value) => {
    return value.toLocaleString();
  };

  render() {
    const { nrqlQueries, stroke, fill } = this.props;

    const nrqlQueryPropsAvailable =
      nrqlQueries &&
      nrqlQueries[0] &&
      nrqlQueries[0].accountId &&
      nrqlQueries[0].query;
    console.log({ nrqlQueryPropsAvailable });
    if (!nrqlQueryPropsAvailable) {
      return <EmptyState />;
    }
    const { query, accountId } = nrqlQueries[0];
    // const parsedQuery = this.parseQuery(query, accountId);
    // console.log({ parsedQuery });
    return <AutoSizer>{({ width, height }) => <FunnelTimingCharts query={query} accountId={accountId} />}</AutoSizer>;
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
      <code>FROM TessenAction SELECT funnel(anonymousId as 'Unique user', WHERE eventName = 'TDEV_DocPageView_pageView' and path = '/instant-observability/' and customer_user_id IS NULL as 'View I/O Home', WHERE eventName = 'TDEV_QuickstartClick_instantObservability' as 'View details', WHERE eventName = 'TDEV_QuickstartInstall_instantObservability' as 'Click install', WHERE eventName = 'TLMK_SignUp_signup' AS 'Signup form', WHERE eventName = 'TLMK_SignUp_signupThankYou' AS 'Signup success') SINCE 4 weeks ago LIMIT MAX</code>
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
