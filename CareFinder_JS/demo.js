// Downloaded HTML demo only. Hosted requests always call /api/rank.
const sampleResponse = {
  service_id: "dialysis",
  radius_km: 30,
  distance_method: "straight_line",
  results: [
    {
      facility_id: "demo_a",
      facility_name: "Demo Hospital A",
      latitude: 26.9304,
      longitude: 75.7873,
      address: "Demo address A, Jaipur",
      location_basis: "Facility coordinates from the sample dataset",
      distance_km: 2.0015114442033264,
      relevance_reason: "The record explicitly lists on-site haemodialysis.",
      uncertainties: ["Staffing details are not documented."],
      evidence: [
        {
          field: "description",
          quote: "This unit provides on-site haemodialysis.",
          record_id: "demo_record_a",
        },
      ],
      record_source_urls: ["https://example.org/demo-a"],
      distance_rank: 1,
      relevance_rank: 2,
      fused_rank: 2,
    },
    {
      facility_id: "demo_b",
      facility_name: "Demo Hospital B",
      latitude: 26.9844,
      longitude: 75.7873,
      address: "Demo address B, Jaipur",
      location_basis: "Facility coordinates from the sample dataset",
      distance_km: 8.006045776814366,
      relevance_reason:
        "The record describes a dedicated haemodialysis unit and identifies its nursing staff.",
      uncertainties: [],
      evidence: [
        {
          field: "description",
          quote: "Our dedicated haemodialysis unit is staffed by dialysis nurses.",
          record_id: "demo_record_b",
        },
      ],
      record_source_urls: ["https://example.org/demo-b"],
      distance_rank: 2,
      relevance_rank: 1,
      fused_rank: 1,
    },
  ],
  fusion_method:
    "Demo rule: add distance and relevance ranks. The smaller sum wins. Ties favor the better relevance rank.",
};
function standaloneSearch(request) {
  const radians = (degrees) => (degrees * Math.PI) / 180;
  const distance = (row) => {
    const a = radians(request.origin.latitude),
      b = radians(row.latitude);
    const h =
      Math.sin((b - a) / 2) ** 2 +
      Math.cos(a) * Math.cos(b) * Math.sin(radians(row.longitude - request.origin.longitude) / 2) ** 2;
    return 12742.0176 * Math.asin(Math.sqrt(Math.min(1, h)));
  };
  const results =
    request.service_id === "dialysis"
      ? sampleResponse.results
          .map((r) => ({ ...r, distance_km: distance(r) }))
          .filter((r) => r.distance_km <= request.radius_km)
      : [];
  const assign = (key, compare) =>
    [...results].sort(compare).forEach((r, i) => {
      r[key] = i + 1;
    });
  assign(
    "distance_rank",
    (a, b) => a.distance_km - b.distance_km || a.facility_id.localeCompare(b.facility_id),
  );
  assign("relevance_rank", (a, b) => b.facility_id.localeCompare(a.facility_id));
  assign(
    "fused_rank",
    (a, b) =>
      a.distance_rank + a.relevance_rank - (b.distance_rank + b.relevance_rank) ||
      a.relevance_rank - b.relevance_rank,
  );
  return {
    service_id: request.service_id,
    radius_km: request.radius_km,
    distance_method: "straight_line",
    results,
    fusion_method: sampleResponse.fusion_method,
  };
}
