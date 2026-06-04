export const sampleSpec = `{
  "$schema": "https://vega.github.io/schema/vega/v6.json",
  "description": "Default Vega example for cohort-based Semantic SVG authoring.",
  "width": 560,
  "height": 340,
  "padding": 45,
  "title": {
    "text": "Monthly Maximum Temperature in Seattle"
  },
  "data": [
    {
      "name": "table",
      "values": [
        {
          "month": "Jan",
          "temp_max": 32,
          "weather": "Rain"
        },
        {
          "month": "Feb",
          "temp_max": 38,
          "weather": "Rain"
        },
        {
          "month": "Mar",
          "temp_max": 47,
          "weather": "Drizzle"
        },
        {
          "month": "Apr",
          "temp_max": 61,
          "weather": "Cool"
        },
        {
          "month": "May",
          "temp_max": 74,
          "weather": "Sun"
        },
        {
          "month": "Jun",
          "temp_max": 85,
          "weather": "Sun"
        },
        {
          "month": "Jul",
          "temp_max": 96,
          "weather": "Sun"
        },
        {
          "month": "Aug",
          "temp_max": 91,
          "weather": "Sun"
        },
        {
          "month": "Sep",
          "temp_max": 74,
          "weather": "Cool"
        },
        {
          "month": "Oct",
          "temp_max": 62,
          "weather": "Rain"
        },
        {
          "month": "Nov",
          "temp_max": 45,
          "weather": "Rain"
        },
        {
          "month": "Dec",
          "temp_max": 34,
          "weather": "Rain"
        }
      ]
    }
  ],
  "scales": [
    {
      "name": "xscale",
      "type": "band",
      "domain": {
        "data": "table",
        "field": "month"
      },
      "range": "width",
      "padding": 0.12
    },
    {
      "name": "yscale",
      "type": "linear",
      "domain": {
        "data": "table",
        "field": "temp_max"
      },
      "range": "height",
      "nice": true,
      "zero": true
    },
    {
      "name": "color",
      "type": "ordinal",
      "domain": {
        "data": "table",
        "field": "weather"
      },
      "range": [
        "#4c78a8",
        "#f58518",
        "#54a24b",
        "#e45756"
      ]
    }
  ],
  "axes": [
    {
      "orient": "bottom",
      "scale": "xscale",
      "title": "Month"
    },
    {
      "orient": "left",
      "scale": "yscale",
      "title": "Max Temp (F)"
    }
  ],
  "legends": [
    {
      "fill": "color",
      "title": "Weather type"
    }
  ],
  "marks": [
    {
      "type": "rect",
      "from": {
        "data": "table"
      },
      "encode": {
        "enter": {
          "x": {
            "scale": "xscale",
            "field": "month"
          },
          "width": {
            "scale": "xscale",
            "band": 1
          },
          "y": {
            "scale": "yscale",
            "field": "temp_max"
          },
          "y2": {
            "scale": "yscale",
            "value": 0
          },
          "fill": {
            "scale": "color",
            "field": "weather"
          },
          "tooltip": {
            "signal": "datum.month + ': ' + datum.temp_max + 'F'"
          }
        }
      }
    }
  ]
}`;
