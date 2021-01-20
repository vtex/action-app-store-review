import type { AxiosInstance } from 'axios'
import axios from 'axios'
import { getInput } from '@actions/core'

export interface Issue {
  key: string
  rule: string
  component: string
  message: string
  severity: 'INFO' | 'MINOR' | 'MAJOR' | 'CRITICAL' | 'BLOCKER'
  project: string
  line: number
  hash: string
  status: 'OPEN' | 'CONFIRMED' | 'REOPENED' | 'RESOLVED' | 'CLOSED'
  MESSAGE: string
  effort: string
  debt: string
  author: string
  tag: string[]
  creationDate: Date
  updateDate: Date
  type: 'CODE_SMELL' | 'BUG' | 'VULNERABILITY'
  organization: string
  scope: string
  textRange: {
    startLine: number
    endLine: number
    startOffset: number
    endOffset: number
  }
}
interface IssuesResponseAPI {
  total: number
  p: number
  ps: number
  paging: {
    pageIndex: number
    pageSize: number
    total: number
  }
  effortTotal: number
  debtTotal: number
  issues: [Issue]
}
export default class Sonarqube {
  private http: AxiosInstance
  public host: string
  private token: string
  public project: {
    projectKey: string
    projectName: string
    projectBaseDir: string
  }

  constructor(repo: { owner: string; repo: string }) {
    const info = this.getInfo(repo)

    this.host = info.host
    this.token = info.token
    this.project = info.project
    const tokenb64 = Buffer.from(`${this.token}:`).toString('base64')

    this.http = axios.create({
      baseURL: this.host,
      timeout: 10000,
      headers: {
        Authorization: `Basic ${tokenb64}`,
      },
    })
  }

  public getIssues = async ({
    pageSize,
    page,
    status = 'OPEN',
  }: {
    pageSize: number
    page: number
    status?: string
  }): Promise<Issue[]> => {
    try {
      const response = await this.http.get<IssuesResponseAPI>(
        `/api/issues/search?componentKeys=${this.project.projectKey}&statuses=${status}&ps=${pageSize}&p=${page}`
      )

      if (response.status !== 200 || !response.data) {
        return []
      }

      const {
        data: { issues },
      } = response

      if (pageSize * page >= response.data.paging.total) {
        return issues
      }

      return issues.concat(await this.getIssues({ pageSize, page: page + 1 }))
    } catch (err) {
      throw new Error(
        'Error getting project issues from SonarQube. Please make sure you provided the host and token inputs.'
      )
    }
  }

  public getScannerCommand = () =>
    `sonar-scanner -Dsonar.projectKey=${this.project.projectKey} -Dsonar.projectName=${this.project.projectName} -Dsonar.sources=. -Dsonar.projectBaseDir=${this.project.projectBaseDir} -Dsonar.login=${this.token} -Dsonar.host.url=${this.host}`

  private getInfo = (repo: { owner: string; repo: string }) => ({
    project: {
      projectKey: getInput('projectKey')
        ? getInput('projectKey')
        : `${repo.owner}-${repo.repo}`,
      projectName: getInput('projectName')
        ? getInput('projectName')
        : `${repo.owner}-${repo.repo}`,
      projectBaseDir: getInput('projectBaseDir'),
    },
    host: getInput('host'),
    token: getInput('token'),
  })
}
