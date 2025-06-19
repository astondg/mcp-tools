# GET /projects/0.1/projects/active/

## Query Params
query	string (optional) Example: some query
filterSet of space separated terms used to search project names and descriptions.

project_types[]	array[enum[string]] (optional) 
filterReturns projects with the specific type.

Choices:
fixed
hourly
project_upgrades[]	array[enum[string]] (optional) 
filterReturns projects with the specific project upgrades.

Choices:
featured
sealed
nonpublic
fulltime
urgent
qualified
NDA
assisted
pf_only
ip_contract
contest_upgrades[]	array[enum[string]] (optional) 
filterReturns projects with the specific contest upgrades.

Choices:
featured
sealed
nonpublic
highlight
guaranteed
min_avg_price	decimal (optional) Example: 1.0
filterReturns projects with the specified minimum average bid in USD.

max_avg_price	decimal (optional) Example: 2.0
filterReturns projects with the specified maximum average bid in USD.

min_avg_hourly_rate	decimal (optional) Example: 1.0
filterReturns projects with the specified minimum hourly bid rate in USD.

max_avg_hourly_rate	decimal (optional) Example: 1.0
filterReturns projects with the specified maximum hourly bid rate in USD.

min_price	decimal (optional) Example: 1.0
filterReturns projects with a minimum fixed price budget that’s greater than or equal to the specified value in USD.

max_price	decimal (optional) Example: 10.0
filterReturns projects with a maximum fixed price budget that’s less than or equal to the specified value in USD.

min_hourly_rate	decimal (optional) Example: 5.0
filterReturns projects with a minimum hourly rate budget that’s greater than or equal to the specified value in USD.

max_hourly_rate	decimal (optional) Example: 15.0
filterReturns projects with a maximum hourly rate budget that’s less than or equal to the specified value in USD.

jobs[]	array[number] (optional) Example: 1, 2
filterReturns projects with at least one of the specified job IDs.

countries[]	array[string] (optional) Example: au, us
filterReturns projects with at least one of the specified country codes.

languages[]	array[string] (optional) Example: en, es
filterReturns projects with at least one of the specified language IDs.

latitude	number (optional) Example: -33.8
filterReturns projects whose location is near the specified latitude.

longitude	number (optional) Example: 151.2
filterReturns projects whose location is near the specified longitude.

from_time	number (optional) Example: 1481179011
filterReturns projects last updated after this time (inclusive).

to_time	number (optional) Example: 1481179011
filterReturns projects last updated before this time (inclusive).

sort_field	string (optional) Example: time_updated
filterSorting field, by default searches by relevance, otherwise most recently updated.

Choices:
time_updated
bid_count
bid_enddate
bid_avg_usd
project_ids	array[number] (optional) Example: 1, 2
filterReturns projects with the specified project IDs.

top_right_latitude	number (optional) Example: -24.6
filterReturns projects whose location is within the map boundaries.

top_right_longitude	number (optional) Example: 140.5
filterReturns projects whose location is within the map boundaries.

bottom_left_latitude	number (optional) Example: -31.9
filterReturns projects whose location is within the map boundaries.

bottom_left_longitude	number (optional) Example: 127.1
filterReturns projects whose location is within the map boundaries.

reverse_sort	boolean (optional) 
projectionIf true, results appear in ascending order instead of descending order.

or_search_query	string (optional) Example: some other query
projectionIf true search return results which match any term inquery, rather than all terms being present.

highlight_pre_tags	string (optional) Example: +
projectionAdds this tag before any matching term in the project description.

highlight_post_tags	string (optional) Example: +
projectionAdds this tag after any matching term in the project description.

full_description	boolean (optional) 
projectionReturns the full project description.

job_details	boolean (optional) 
projectionReturns job information.

upgrade_details	boolean (optional) 
projectionReturns upgrade information.

user_details	boolean (optional) 
projectionReturns basic user information.

location_details	boolean (optional) 
projectionReturns information about a project’s location.

nda_signature_details	boolean (optional) 
projectionReturns list of users who have signed an NDA for the project.

project_collaboration_details	boolean (optional) 
projectionReturns a list of the collaborators of a project.

user_avatar	boolean (optional) 
projectionReturns the avatar of the selected user/users.

user_country_details	boolean (optional) 
projectionReturns the country flag/code of selected user/users.

user_profile_description	boolean (optional) 
projectionReturns the profile blurb of selected user/users.

user_display_info	boolean (optional) 
projectionReturns the display name of the selected user/users.

user_jobs	boolean (optional) 
projectionReturns the jobs of the selected user/users.

user_balance_details	boolean (optional) 
projectionReturns the currency balance of selected user/users.

user_qualification_details	boolean (optional) 
projectionReturns qualification exams completed by the user/users.

user_membership_details	boolean (optional) 
projectionReturns the membership information of the user/users.

user_financial_details	boolean (optional) 
projectionReturns the financial information of the user/users.

user_location_details	boolean (optional) 
projectionReturns the location information of the user/users.

user_portfolio_details	boolean (optional) 
projectionReturns the portfolio information of the user/users.

user_preferred_details	boolean (optional) 
projectionReturns the preferred information of the user/users.

user_badge_details	boolean (optional) 
projectionReturns the badges earned by the user/users.

user_status	boolean (optional) 
projectionReturns additional status information about the user/users.

user_reputation	boolean (optional) 
projectionReturns the freelancer reputation of the selected user/users.

user_employer_reputation	boolean (optional) 
projectionReturns the employer reputation of the selected user/users.

user_reputation_extra	boolean (optional) 
projectionReturns the full freelancer reputation of the selected user/users.

user_employer_reputation_extra	boolean (optional) 
projectionReturns the full employer reputation of the selected user/users.

user_cover_image	boolean (optional) 
projectionReturns the profile picture of the user.

user_past_cover_images	boolean (optional) 
projectionReturns previous profile pictures of the user.

user_recommendations	boolean (optional) 
projectionReturns recommendations count of selected user/users.

user_responsiveness	boolean (optional) 
projectionReturns the responsiveness score(s) of the selected user/users.

corporate_users	boolean (optional) 
projectionReturns the corporate accounts that the selected user/users has created/founded.

marketing_mobile_number	boolean (optional) 
projectionReturns the mobile number of the user being used by the recruiter to contact the user.

sanction_details	boolean (optional) 
projectionReturns the end timestamp of the sanction given to the user.

limited_account	boolean (optional) 
projectionReturns the limit account status of the user.

equipment_group_details	boolean (optional) 
projectionReturns the equipment groups and items attached to the user.

limit	number (optional) Example: 10
Maximum number of results to return.

offset	number (optional) Example: 100
Number of results to skip, allows pagination of results.

compact	boolean (optional) 
If set, strip all null and empty values from response.

## Response Example

```
{
  "$schema": "http://json-schema.org/draft-04/schema#",
  "type": "object",
  "properties": {
    "status": {
      "type": "string",
      "enum": [
        "success"
      ]
    },
    "request_id": {
      "type": "string"
    },
    "result": {
      "type": "object",
      "properties": {
        "total_count": {
          "type": "number"
        },
        "selected_bids": {
          "type": "null"
        },
        "users": {
          "type": "null"
        },
        "projects": {
          "type": "array",
          "items": {
            "type": "object",
            "properties": {
              "id": {
                "type": "number"
              },
              "owner_id": {
                "type": "number"
              },
              "title": {
                "type": "string"
              },
              "status": {
                "type": "string",
                "enum": [
                  "active",
                  "closed",
                  "frozen",
                  "draft",
                  "pending",
                  "rejected"
                ]
              },
              "seo_url": {
                "type": "string"
              },
              "currency": {
                "type": "object",
                "properties": {
                  "id": {
                    "type": "number"
                  },
                  "code": {
                    "type": "string"
                  },
                  "sign": {
                    "type": "string"
                  },
                  "name": {
                    "type": "string"
                  },
                  "exchange_rate": {
                    "type": "number",
                    "description": "Decimal"
                  },
                  "country": {
                    "type": "string"
                  },
                  "is_external": {
                    "type": "boolean"
                  }
                },
                "required": [
                  "id",
                  "code",
                  "sign"
                ]
              },
              "description": {
                "type": [
                  "string",
                  "null"
                ]
              },
              "jobs": {
                "type": [
                  "array",
                  "null"
                ]
              },
              "preview_description": {
                "type": "string"
              },
              "deleted": {
                "type": "boolean"
              },
              "type": {
                "type": "string",
                "enum": [
                  "fixed",
                  "hourly"
                ]
              },
              "bidperiod": {
                "type": "number"
              },
              "budget": {
                "type": "object",
                "properties": {
                  "minimum": {
                    "type": "number",
                    "description": "Decimal"
                  },
                  "maximum": {
                    "type": "number",
                    "description": "Decimal"
                  },
                  "name": {
                    "type": "string"
                  },
                  "project_type": {
                    "type": "string",
                    "enum": [
                      "fixed",
                      "hourly"
                    ]
                  },
                  "currency_id": {
                    "type": "number"
                  }
                },
                "required": [
                  "minimum",
                  "currency_id"
                ]
              },
              "bid_stats": {
                "type": "object",
                "properties": {
                  "bid_count": {
                    "type": "number"
                  },
                  "bid_avg": {
                    "type": "number",
                    "description": "Decimal"
                  }
                }
              },
              "time_submitted": {
                "type": "number"
              },
              "time_updated": {
                "type": "number"
              },
              "upgrades": {
                "type": "object",
                "properties": {
                  "NDA": {
                    "type": "boolean"
                  },
                  "urgent": {
                    "type": "boolean"
                  },
                  "featured": {
                    "type": "boolean"
                  },
                  "nonpublic": {
                    "type": "boolean"
                  },
                  "fulltime": {
                    "type": "boolean"
                  },
                  "qualified": {
                    "type": "boolean"
                  },
                  "sealed": {
                    "type": "boolean"
                  },
                  "ip_contract": {
                    "type": "boolean"
                  },
                  "success_bundle": {
                    "type": "boolean"
                  },
                  "non_compete": {
                    "type": "boolean"
                  },
                  "project_management": {
                    "type": "boolean"
                  },
                  "pf_only": {
                    "type": "boolean"
                  },
                  "listed": {
                    "type": "boolean"
                  },
                  "recruiter": {
                    "type": "boolean"
                  }
                },
                "required": [
                  "qualified"
                ]
              },
              "language": {
                "type": "string"
              },
              "hireme": {
                "type": "boolean"
              },
              "frontend_project_status": {
                "type": "string",
                "enum": [
                  "open",
                  "work_in_progress",
                  "complete",
                  "pending",
                  "draft"
                ]
              },
              "location": {
                "type": "object",
                "properties": {
                  "country": {
                    "type": "object",
                    "properties": {
                      "name": {
                        "type": "string"
                      },
                      "flag_url": {
                        "type": [
                          "string",
                          "null"
                        ]
                      },
                      "code": {
                        "type": [
                          "string",
                          "null"
                        ]
                      },
                      "highres_flag_url": {
                        "type": [
                          "string",
                          "null"
                        ]
                      },
                      "flag_url_cdn": {
                        "type": [
                          "string",
                          "null"
                        ]
                      },
                      "highres_flag_url_cdn": {
                        "type": [
                          "string",
                          "null"
                        ]
                      }
                    }
                  },
                  "city": {
                    "type": "string"
                  },
                  "latitude": {
                    "type": [
                      "number",
                      "null"
                    ]
                  },
                  "longitude": {
                    "type": [
                      "number",
                      "null"
                    ]
                  },
                  "vicinity": {
                    "type": [
                      "string",
                      "null"
                    ]
                  },
                  "administritive_area": {
                    "type": [
                      "string",
                      "null"
                    ]
                  },
                  "full_address": {
                    "type": [
                      "string",
                      "null"
                    ]
                  }
                }
              },
              "local": {
                "type": "boolean"
              },
              "negotiated": {
                "type": "boolean"
              },
              "time_free_bids_expire": {
                "type": "number"
              },
              "support_sessions": {
                "type": "array"
              },
              "nda_details": {
                "type": "object",
                "properties": {
                  "hidden_description": {
                    "type": "string"
                  },
                  "signatures": {
                    "type": "array"
                  }
                }
              },
              "local_details": {
                "type": "object",
                "properties": {
                  "id": {
                    "type": "number"
                  },
                  "project_id": {
                    "type": "number"
                  },
                  "date": {
                    "type": "object",
                    "properties": {
                      "year": {
                        "type": "number"
                      },
                      "month": {
                        "type": "number"
                      },
                      "day": {
                        "type": "number"
                      }
                    },
                    "required": [
                      "year",
                      "month",
                      "day"
                    ],
                    "description": "date specified by the employer when the project must be done"
                  },
                  "end_location": {
                    "type": "object",
                    "properties": {
                      "country": {
                        "type": "object",
                        "properties": {
                          "name": {
                            "type": "string"
                          },
                          "flag_url": {
                            "type": [
                              "string",
                              "null"
                            ]
                          },
                          "code": {
                            "type": [
                              "string",
                              "null"
                            ]
                          },
                          "highres_flag_url": {
                            "type": [
                              "string",
                              "null"
                            ]
                          },
                          "flag_url_cdn": {
                            "type": [
                              "string",
                              "null"
                            ]
                          },
                          "highres_flag_url_cdn": {
                            "type": [
                              "string",
                              "null"
                            ]
                          }
                        }
                      },
                      "city": {
                        "type": "string"
                      },
                      "latitude": {
                        "type": [
                          "number",
                          "null"
                        ]
                      },
                      "longitude": {
                        "type": [
                          "number",
                          "null"
                        ]
                      },
                      "vicinity": {
                        "type": [
                          "string",
                          "null"
                        ]
                      },
                      "administritive_area": {
                        "type": [
                          "string",
                          "null"
                        ]
                      },
                      "full_address": {
                        "type": [
                          "string",
                          "null"
                        ]
                      }
                    }
                  }
                },
                "required": [
                  "id",
                  "project_id"
                ]
              },
              "equipment_group_details": {
                "type": "array"
              },
              "service_offering_id": {
                "type": "number"
              }
            },
            "required": [
              "id",
              "owner_id",
              "title",
              "status",
              "deleted"
            ]
          }
        }
      },
      "required": [
        "total_count",
        "projects"
      ]
    }
  },
  "required": [
    "status",
    "result"
  ]
}
```

# GET /projects/0.1/projects/{project_id}/

## Query Params
project_id	number (required) Example: 1
filterID of project.

full_description	boolean (optional) 
projectionReturns full project description.

job_details	boolean (optional) 
projectionReturns job information.

upgrade_details	boolean (optional) 
projectionReturns upgrade information.

attachment_details	boolean (optional) 
projectionReturns attachment details.

file_details	boolean (optional) 
projectionReturns files shared between the employer and the freelancer.

qualification_details	boolean (optional) 
projectionReturns exams needed to qualify.

selected_bids	boolean (optional) 
projectionReturns bids that have been awarded or are pending for returned projects.

hireme_details	boolean (optional) 
projectionReturns information about hireme offers.

user_details	boolean (optional) 
projectionReturns basic user information.

invited_freelancer_details	boolean (optional) 
projectionReturns a list of invited freelancer user IDs. Ifuser_detailsis set, the information appears there.

recommended_freelancer_details	boolean (optional) 
projectionReturns a list of freelancer user IDs recommended to invite to bid on project. If user_details is set, the information appears there. Must be the project owner to view recommended Freelancers. Cannot view recommended Freelancers for more than one project. Requires job_details to be set.

hourly_details	boolean (optional) 
projectionReturns a map of hourly contracts indexed by user ID of the bidder.

support_session_details	boolean (optional) 
projectionReturns list of support sessions for project.

location_details	boolean (optional) 
projectionReturns information about a project’s location.

nda_signature_details	boolean (optional) 
projectionReturns list of users who have signed an NDA for the project.

project_collaboration_details	boolean (optional) 
projectionReturns a list of the collaborators of a project.

track_details	boolean (optional) 
projectionReturns a list of track IDs associated with the project.

proximity_details	boolean (optional) 
projectionReturns information about the project’s proximity.

review_availability_details	boolean (optional) 
projectionReturns information about the project’s review availability.

negotiated_details	boolean (optional) 
projectionReturns information about the project’s negotiated offers.

drive_file_details	boolean (optional) 
projectionReturns whether the project has any drive files.

nda_details	boolean (optional) 
projectionReturns details about the NDA on the project. This includes a hidden description only for users who have signed the NDA as well as viewable signatures.

local_details	boolean (optional) 
projectionReturns details about local projects.

user_avatar	boolean (optional) 
projectionReturns the avatar of the selected user/users.

user_country_details	boolean (optional) 
projectionReturns the country flag/code of selected user/users.

user_profile_description	boolean (optional) 
projectionReturns the profile blurb of selected user/users.

user_display_info	boolean (optional) 
projectionReturns the display name of the selected user/users.

user_jobs	boolean (optional) 
projectionReturns the jobs of the selected user/users.

user_balance_details	boolean (optional) 
projectionReturns the currency balance of selected user/users.

user_qualification_details	boolean (optional) 
projectionReturns qualification exams completed by the user/users.

user_membership_details	boolean (optional) 
projectionReturns the membership information of the user/users.

user_financial_details	boolean (optional) 
projectionReturns the financial information of the user/users.

user_location_details	boolean (optional) 
projectionReturns the location information of the user/users.

user_portfolio_details	boolean (optional) 
projectionReturns the portfolio information of the user/users.

user_preferred_details	boolean (optional) 
projectionReturns the preferred information of the user/users.

user_badge_details	boolean (optional) 
projectionReturns the badges earned by the user/users.

user_status	boolean (optional) 
projectionReturns additional status information about the user/users.

user_reputation	boolean (optional) 
projectionReturns the freelancer reputation of the selected user/users.

user_employer_reputation	boolean (optional) 
projectionReturns the employer reputation of the selected user/users.

user_reputation_extra	boolean (optional) 
projectionReturns the full freelancer reputation of the selected user/users.

user_employer_reputation_extra	boolean (optional) 
projectionReturns the full employer reputation of the selected user/users.

user_cover_image	boolean (optional) 
projectionReturns the profile picture of the user.

user_past_cover_images	boolean (optional) 
projectionReturns previous profile pictures of the user.

user_recommendations	boolean (optional) 
projectionReturns recommendations count of selected user/users.

user_responsiveness	boolean (optional) 
projectionReturns the responsiveness score(s) of the selected user/users.

corporate_users	boolean (optional) 
projectionReturns the corporate accounts that the selected user/users has created/founded.

marketing_mobile_number	boolean (optional) 
projectionReturns the mobile number of the user being used by the recruiter to contact the user.

sanction_details	boolean (optional) 
projectionReturns the end timestamp of the sanction given to the user.

limited_account	boolean (optional) 
projectionReturns the limit account status of the user.

equipment_group_details	boolean (optional) 
projectionReturns the equipment groups and items attached to the user.

limit	number (optional) Example: 10
Maximum number of results to return.

offset	number (optional) Example: 100
Number of results to skip, allows pagination of results.

compact	boolean (optional) 
If set, strip all null and empty values from response.

## Response Example
```
{
  "$schema": "http://json-schema.org/draft-04/schema#",
  "type": "object",
  "properties": {
    "status": {
      "type": "string",
      "enum": [
        "success"
      ]
    },
    "request_id": {
      "type": "string"
    },
    "result": {
      "type": "object",
      "properties": {
        "id": {
          "type": "number"
        },
        "owner_id": {
          "type": "number"
        },
        "title": {
          "type": "string"
        },
        "status": {
          "type": "string",
          "enum": [
            "active",
            "closed",
            "frozen",
            "draft",
            "pending",
            "rejected"
          ]
        },
        "seo_url": {
          "type": "string"
        },
        "currency": {
          "type": "object",
          "properties": {
            "id": {
              "type": "number"
            },
            "code": {
              "type": "string"
            },
            "sign": {
              "type": "string"
            },
            "name": {
              "type": "string"
            },
            "exchange_rate": {
              "type": "number",
              "description": "Decimal"
            },
            "country": {
              "type": "string"
            },
            "is_external": {
              "type": "boolean"
            }
          },
          "required": [
            "id",
            "code",
            "sign"
          ]
        },
        "description": {
          "type": [
            "string",
            "null"
          ]
        },
        "jobs": {
          "type": [
            "array",
            "null"
          ]
        },
        "preview_description": {
          "type": "string"
        },
        "deleted": {
          "type": "boolean"
        },
        "type": {
          "type": "string",
          "enum": [
            "fixed",
            "hourly"
          ]
        },
        "bidperiod": {
          "type": "number"
        },
        "budget": {
          "type": "object",
          "properties": {
            "minimum": {
              "type": "number",
              "description": "Decimal"
            },
            "maximum": {
              "type": "number",
              "description": "Decimal"
            },
            "name": {
              "type": "string"
            },
            "project_type": {
              "type": "string",
              "enum": [
                "fixed",
                "hourly"
              ]
            },
            "currency_id": {
              "type": "number"
            }
          },
          "required": [
            "minimum",
            "currency_id"
          ]
        },
        "bid_stats": {
          "type": "object",
          "properties": {
            "bid_count": {
              "type": "number"
            },
            "bid_avg": {
              "type": "number",
              "description": "Decimal"
            }
          }
        },
        "time_submitted": {
          "type": "number"
        },
        "time_updated": {
          "type": "number"
        },
        "upgrades": {
          "type": "object",
          "properties": {
            "NDA": {
              "type": "boolean"
            },
            "urgent": {
              "type": "boolean"
            },
            "featured": {
              "type": "boolean"
            },
            "nonpublic": {
              "type": "boolean"
            },
            "fulltime": {
              "type": "boolean"
            },
            "qualified": {
              "type": "boolean"
            },
            "sealed": {
              "type": "boolean"
            },
            "ip_contract": {
              "type": "boolean"
            },
            "success_bundle": {
              "type": "boolean"
            },
            "non_compete": {
              "type": "boolean"
            },
            "project_management": {
              "type": "boolean"
            },
            "pf_only": {
              "type": "boolean"
            },
            "listed": {
              "type": "boolean"
            },
            "recruiter": {
              "type": "boolean"
            }
          },
          "required": [
            "qualified"
          ]
        },
        "language": {
          "type": "string"
        },
        "hireme": {
          "type": "boolean"
        },
        "frontend_project_status": {
          "type": "string",
          "enum": [
            "open",
            "work_in_progress",
            "complete",
            "pending",
            "draft"
          ]
        },
        "location": {
          "type": "object",
          "properties": {
            "country": {
              "type": "object",
              "properties": {
                "name": {
                  "type": "string"
                },
                "flag_url": {
                  "type": [
                    "string",
                    "null"
                  ]
                },
                "code": {
                  "type": [
                    "string",
                    "null"
                  ]
                },
                "highres_flag_url": {
                  "type": [
                    "string",
                    "null"
                  ]
                },
                "flag_url_cdn": {
                  "type": [
                    "string",
                    "null"
                  ]
                },
                "highres_flag_url_cdn": {
                  "type": [
                    "string",
                    "null"
                  ]
                }
              }
            },
            "city": {
              "type": "string"
            },
            "latitude": {
              "type": [
                "number",
                "null"
              ]
            },
            "longitude": {
              "type": [
                "number",
                "null"
              ]
            },
            "vicinity": {
              "type": [
                "string",
                "null"
              ]
            },
            "administritive_area": {
              "type": [
                "string",
                "null"
              ]
            },
            "full_address": {
              "type": [
                "string",
                "null"
              ]
            }
          }
        },
        "local": {
          "type": "boolean"
        },
        "negotiated": {
          "type": "boolean"
        },
        "time_free_bids_expire": {
          "type": "number"
        },
        "support_sessions": {
          "type": "array"
        },
        "nda_details": {
          "type": "object",
          "properties": {
            "hidden_description": {
              "type": "string"
            },
            "signatures": {
              "type": "array"
            }
          }
        },
        "local_details": {
          "type": "object",
          "properties": {
            "id": {
              "type": "number"
            },
            "project_id": {
              "type": "number"
            },
            "date": {
              "type": "object",
              "properties": {
                "year": {
                  "type": "number"
                },
                "month": {
                  "type": "number"
                },
                "day": {
                  "type": "number"
                }
              },
              "required": [
                "year",
                "month",
                "day"
              ],
              "description": "date specified by the employer when the project must be done"
            },
            "end_location": {
              "type": "object",
              "properties": {
                "country": {
                  "type": "object",
                  "properties": {
                    "name": {
                      "type": "string"
                    },
                    "flag_url": {
                      "type": [
                        "string",
                        "null"
                      ]
                    },
                    "code": {
                      "type": [
                        "string",
                        "null"
                      ]
                    },
                    "highres_flag_url": {
                      "type": [
                        "string",
                        "null"
                      ]
                    },
                    "flag_url_cdn": {
                      "type": [
                        "string",
                        "null"
                      ]
                    },
                    "highres_flag_url_cdn": {
                      "type": [
                        "string",
                        "null"
                      ]
                    }
                  }
                },
                "city": {
                  "type": "string"
                },
                "latitude": {
                  "type": [
                    "number",
                    "null"
                  ]
                },
                "longitude": {
                  "type": [
                    "number",
                    "null"
                  ]
                },
                "vicinity": {
                  "type": [
                    "string",
                    "null"
                  ]
                },
                "administritive_area": {
                  "type": [
                    "string",
                    "null"
                  ]
                },
                "full_address": {
                  "type": [
                    "string",
                    "null"
                  ]
                }
              }
            }
          },
          "required": [
            "id",
            "project_id"
          ]
        },
        "equipment_group_details": {
          "type": "array"
        },
        "service_offering_id": {
          "type": "number"
        }
      },
      "required": [
        "id",
        "owner_id",
        "title",
        "status",
        "deleted"
      ]
    }
  },
  "required": [
    "status",
    "result"
  ]
}
```