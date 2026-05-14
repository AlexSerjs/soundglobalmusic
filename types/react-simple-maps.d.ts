declare module "react-simple-maps" {
  import { ComponentProps, ReactNode } from "react";

  export interface GeographyStyle {
    fill?: string;
    stroke?: string;
    strokeWidth?: number;
    outline?: string;
    cursor?: string;
    transition?: string;
  }

  export interface GeoFeature {
    rsmKey: string;
    properties: Record<string, string | number | undefined>;
  }

  export function ComposableMap(props: {
    projection?: string;
    projectionConfig?: Record<string, number | string>;
    style?: React.CSSProperties;
    children?: ReactNode;
  }): JSX.Element;

  export function ZoomableGroup(props: {
    zoom?: number;
    minZoom?: number;
    maxZoom?: number;
    children?: ReactNode;
  }): JSX.Element;

  export function Geographies(props: {
    geography: string;
    children: (args: { geographies: GeoFeature[] }) => ReactNode;
  }): JSX.Element;

  export function Geography(props: {
    geography: GeoFeature;
    onClick?: (geo: GeoFeature) => void;
    onMouseEnter?: (geo: GeoFeature) => void;
    onMouseLeave?: (geo: GeoFeature) => void;
    style?: {
      default?: GeographyStyle;
      hover?: GeographyStyle;
      pressed?: GeographyStyle;
    };
  }): JSX.Element;
}
